import { collectionRef } from '../../lib/firestore';
import { countInactiveUsers, readDashboardCollections } from '../../../api_handlers/admin/_shared';
import type { AdminAssistantIntent } from '../types';

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && value && typeof (value as any).toDate === 'function') {
    const d = (value as any).toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function periodRange(period: unknown) {
  const now = new Date();
  const end = new Date(now);
  let start = new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  } else if (period === 'week') {
    start = new Date(now);
    start.setDate(now.getDate() - 7);
  }
  return { start, end };
}

function inRange(value: unknown, start: Date, end: Date) {
  const d = toDate(value);
  if (!d) return false;
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export type AssistantQueryResult = {
  answer: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  sources: string[];
};

export async function executeAdminIntent(
  intent: AdminAssistantIntent,
  filters: Record<string, unknown>
): Promise<AssistantQueryResult> {
  const { start, end } = periodRange(filters.period);

  if (intent === 'sales_by_period') {
    const { orders } = await readDashboardCollections();
    const grouped = new Map<string, number>();
    orders
      .filter((order: any) => order.status !== 'cancelado')
      .filter((order: any) => inRange(order.createdAt, start, end))
      .forEach((order: any) => {
        const date = toDate(order.createdAt);
        const key = date ? date.toISOString().slice(0, 10) : 'sin_fecha';
        grouped.set(key, (grouped.get(key) || 0) + Number(order.total || 0));
      });
    const rows = [...grouped.entries()]
      .map(([periodo, ventas]) => ({ periodo, ventas: round(ventas) }))
      .sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)));
    return {
      answer: `Se encontraron ${rows.length} periodos con ventas en el rango consultado.`,
      columns: ['periodo', 'ventas'],
      rows,
      sources: ['orders']
    };
  }

  if (intent === 'sales_by_vendor') {
    const { orders } = await readDashboardCollections();
    const grouped = new Map<string, number>();
    orders
      .filter((order: any) => order.status !== 'cancelado')
      .filter((order: any) => inRange(order.createdAt, start, end))
      .forEach((order: any) => {
        const vendor = String(order.assignedSalesRepName || order.assignedSalesRep || 'Sin vendedor');
        grouped.set(vendor, (grouped.get(vendor) || 0) + Number(order.total || 0));
      });
    const rows = [...grouped.entries()]
      .map(([vendedor, ventas]) => ({ vendedor, ventas: round(ventas) }))
      .sort((a, b) => Number(b.ventas) - Number(a.ventas));
    const leader = rows[0]?.vendedor;
    return {
      answer: leader
        ? `Las ventas del periodo muestran a ${leader} liderando.`
        : 'No se encontraron ventas para el periodo consultado.',
      columns: ['vendedor', 'ventas'],
      rows,
      sources: ['orders']
    };
  }

  if (intent === 'orders_by_status') {
    const { orders } = await readDashboardCollections();
    const grouped = new Map<string, number>();
    orders
      .filter((order: any) => inRange(order.createdAt, start, end))
      .forEach((order: any) => {
        const status = String(order.status || 'sin_estado');
        grouped.set(status, (grouped.get(status) || 0) + 1);
      });
    const rows = [...grouped.entries()].map(([estado, pedidos]) => ({ estado, pedidos }));
    return {
      answer: `Se consolidaron ${rows.length} estados de pedidos para el periodo consultado.`,
      columns: ['estado', 'pedidos'],
      rows,
      sources: ['orders']
    };
  }

  if (intent === 'inactive_clients') {
    const [customersSnapshot, ordersSnapshot] = await Promise.all([
      collectionRef('customers').limit(1000).get(),
      collectionRef('orders').limit(3000).get()
    ]);
    const customers = customersSnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }));
    const orders = ordersSnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }));
    const rows = customers
      .map((customer: any) => {
        const email = String(customer.email || '').toLowerCase();
        const customerOrders: any[] = orders
          .filter((order: any) => String(order.customerEmail || '').toLowerCase() === email)
          .sort((a: any, b: any) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
        const lastOrderAt = customerOrders[0] ? toDate(customerOrders[0].createdAt)?.toISOString() || null : null;
        const isInactive = !customerOrders[0] || !inRange(customerOrders[0].createdAt, start, end);
        return {
          cliente: customer.name || customer.email || customer.id,
          email: customer.email || '',
          empresa: customer.company || '',
          lastOrderAt,
          isInactive
        };
      })
      .filter((row) => row.isInactive)
      .map(({ isInactive, ...rest }) => rest);
    return {
      answer: `Se detectaron ${rows.length} clientes sin compras recientes en el periodo evaluado.`,
      columns: ['cliente', 'email', 'empresa', 'lastOrderAt'],
      rows,
      sources: ['customers', 'orders']
    };
  }

  if (intent === 'portfolio_by_vendor') {
    const [profilesSnapshot, appUsers] = await Promise.all([
      collectionRef('userProfiles').limit(2000).get(),
      collectionRef('userProfiles').firestore.collection('noop').limit(1).get().catch(() => null)
    ]);
    void appUsers;
    const profiles = profilesSnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }));
    const vendorProfiles = profiles.filter((profile: any) => profile.role === 'vendedor');
    const socios = profiles.filter((profile: any) => profile.role === 'socio');
    const rows = vendorProfiles.map((vendor: any) => ({
      vendedor: vendor.displayName || vendor.email || vendor.id,
      cartera: socios.filter((socio: any) => socio.vendorId === vendor.uid || socio.vendorId === vendor.id).length
    })).sort((a, b) => Number(b.cartera) - Number(a.cartera));
    return {
      answer: `Se consolidó la cartera de ${rows.length} vendedores.`,
      columns: ['vendedor', 'cartera'],
      rows,
      sources: ['userProfiles']
    };
  }

  if (intent === 'top_products') {
    const { orders } = await readDashboardCollections();
    const grouped = new Map<string, number>();
    orders
      .filter((order: any) => order.status !== 'cancelado')
      .filter((order: any) => inRange(order.createdAt, start, end))
      .forEach((order: any) => {
        const items = Array.isArray(order.items) ? order.items : [];
        items.forEach((item: any) => {
          const key = String(item.productName || item.productId || 'Sin producto');
          grouped.set(key, (grouped.get(key) || 0) + Number(item.quantity || 0));
        });
      });
    const rows = [...grouped.entries()]
      .map(([producto, rotacion]) => ({ producto, rotacion }))
      .sort((a, b) => Number(b.rotacion) - Number(a.rotacion))
      .slice(0, 20);
    return {
      answer: `Se identificaron ${rows.length} productos con mayor rotación.`,
      columns: ['producto', 'rotacion'],
      rows,
      sources: ['orders']
    };
  }

  if (intent === 'operational_alerts') {
    const [{ orders, quotes, preparations }, inactiveUsers] = await Promise.all([
      readDashboardCollections(),
      countInactiveUsers()
    ]);
    const rows = [
      { alerta: 'Pedidos pendientes operativos', valor: orders.filter((o: any) => ['pendiente', 'confirmado', 'procesando'].includes(String(o.status || ''))).length },
      { alerta: 'Cotizaciones en revisión', valor: quotes.filter((q: any) => ['aprobado_vendedor', 'en_revision_admin'].includes(String(q.status || ''))).length },
      { alerta: 'Despachos pendientes aprobación', valor: preparations.filter((p: any) => p.inspectionStatus === 'approved' && (p.adminApprovalStatus === 'pending' || !p.adminApprovalStatus)).length },
      { alerta: 'Pedidos en tránsito', valor: orders.filter((o: any) => o.status === 'enviado').length },
      { alerta: 'Usuarios inactivos', valor: inactiveUsers }
    ];
    return {
      answer: 'Se consolidaron alertas operativas y de inventario para seguimiento administrativo.',
      columns: ['alerta', 'valor'],
      rows,
      sources: ['orders', 'quotes', 'orderPreparations', 'userProfiles']
    };
  }

  throw new Error(`Intent no soportado: ${intent}`);
}
