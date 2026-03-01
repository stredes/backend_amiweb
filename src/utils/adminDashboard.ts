type TimestampLike = {
  toDate?: () => Date;
  seconds?: number;
  _seconds?: number;
};

export type AdminOrderLike = {
  id?: string;
  orderNumber?: string;
  customerEmail?: string;
  customerName?: string;
  organization?: string;
  total?: number;
  status?: string;
  createdAt?: TimestampLike | Date | string | number | null;
  deliveredAt?: TimestampLike | Date | string | number | null;
};

export type AdminQuoteLike = {
  id?: string;
  quoteNumber?: string;
  customerEmail?: string;
  customerName?: string;
  organization?: string;
  status?: string;
  createdAt?: TimestampLike | Date | string | number | null;
};

export type AdminPreparationLike = {
  orderId?: string;
  status?: string;
  inspectionStatus?: string;
  adminApprovalStatus?: string;
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object') {
    const asTimestamp = value as TimestampLike;
    if (typeof asTimestamp.toDate === 'function') {
      const d = asTimestamp.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const seconds = asTimestamp.seconds ?? asTimestamp._seconds;
    if (typeof seconds === 'number') {
      const d = new Date(seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

function toSafeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function inRange(value: unknown, start: Date, end: Date): boolean {
  const date = toDate(value);
  if (!date) return false;
  const time = date.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

function round(value: number, decimals = 2): number {
  const m = 10 ** decimals;
  return Math.round(value * m) / m;
}

export function getMonthRange(referenceDate = new Date()) {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export function computeExecutiveSummary(orders: AdminOrderLike[], referenceDate = new Date()) {
  const { start, end } = getMonthRange(referenceDate);
  const ordersInMonth = orders.filter((order) => inRange(order.createdAt, start, end));
  const deliveredInMonth = ordersInMonth.filter((order) => order.status === 'entregado');
  const revenue = ordersInMonth.reduce((acc, order) => acc + toSafeNumber(order.total), 0);

  return {
    period: {
      from: start.toISOString(),
      to: end.toISOString()
    },
    revenueMonth: round(revenue),
    ordersMonth: ordersInMonth.length,
    averageTicket: ordersInMonth.length > 0 ? round(revenue / ordersInMonth.length) : 0,
    fulfillmentRate: ordersInMonth.length > 0 ? round((deliveredInMonth.length / ordersInMonth.length) * 100) : 0
  };
}

export function computeOrdersByStatus(orders: AdminOrderLike[]) {
  return orders.reduce<Record<string, number>>((acc, order) => {
    const status = (order.status || 'sin_estado').toString();
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
}

export function computeTopClients(orders: AdminOrderLike[], limit = 10) {
  const grouped = new Map<string, { customerKey: string; customerName: string; organization: string; orderCount: number; totalInvoiced: number }>();

  orders.forEach((order) => {
    const email = (order.customerEmail || '').toLowerCase().trim();
    const name = (order.customerName || '').trim();
    const org = (order.organization || '').trim();
    const key = email || name || order.id || 'cliente-desconocido';
    const current = grouped.get(key) || {
      customerKey: key,
      customerName: name || email || 'Sin nombre',
      organization: org || 'Sin organización',
      orderCount: 0,
      totalInvoiced: 0
    };

    current.orderCount += 1;
    current.totalInvoiced += toSafeNumber(order.total);
    grouped.set(key, current);
  });

  return [...grouped.values()]
    .map((item) => ({
      ...item,
      totalInvoiced: round(item.totalInvoiced)
    }))
    .sort((a, b) => {
      if (b.totalInvoiced !== a.totalInvoiced) return b.totalInvoiced - a.totalInvoiced;
      return b.orderCount - a.orderCount;
    })
    .slice(0, limit);
}

export function computeOperationalControl(
  orders: AdminOrderLike[],
  quotes: AdminQuoteLike[],
  preparations: AdminPreparationLike[],
  inactiveUsers: number
) {
  const pendingOperational = orders.filter((order) => ['pendiente', 'confirmado', 'procesando'].includes(order.status || '')).length;
  const inTransit = orders.filter((order) => order.status === 'enviado').length;
  const approvalsInReview = quotes.filter((quote) => quote.status === 'aprobado_vendedor' || quote.status === 'en_revision_admin').length;
  const pendingDispatchApproval = preparations.filter((prep) =>
    prep.inspectionStatus === 'approved' && (prep.adminApprovalStatus === 'pending' || !prep.adminApprovalStatus)
  ).length;

  return {
    pendingOperational,
    approvalsInReview,
    pendingDispatchApproval,
    inTransit,
    inactiveUsers
  };
}

export function computePendingApprovals(quotes: AdminQuoteLike[], preparations: AdminPreparationLike[]) {
  const quoteApprovals = quotes
    .filter((quote) => quote.status === 'aprobado_vendedor' || quote.status === 'en_revision_admin')
    .map((quote) => ({
      type: 'quote',
      id: quote.id || '',
      number: quote.quoteNumber || '',
      customerName: quote.customerName || '',
      organization: quote.organization || '',
      status: quote.status || '',
      createdAt: toDate(quote.createdAt)?.toISOString() || null
    }));

  const dispatchApprovals = preparations
    .filter((prep) => prep.inspectionStatus === 'approved' && (prep.adminApprovalStatus === 'pending' || !prep.adminApprovalStatus))
    .map((prep) => ({
      type: 'dispatch',
      id: prep.orderId || '',
      number: prep.orderId || '',
      status: prep.adminApprovalStatus || 'pending',
      createdAt: null
    }));

  return {
    total: quoteApprovals.length + dispatchApprovals.length,
    quoteApprovals,
    dispatchApprovals
  };
}
