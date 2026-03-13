import { collectionRef } from '../../lib/firestore';
import { computeExecutiveSummary, computeOperationalControl, computeTopClients } from '../../utils/adminDashboard';
import { countInactiveUsers, readDashboardCollections } from '../../../api_handlers/admin/_shared';
import { listNotifications } from '../../utils/notificationsReadOnly';
import type { ClawbotToolCall, ClawbotToolName } from '../types';

export type ToolExecutionResult = {
  tool: ClawbotToolName;
  summary: string;
  table?: {
    columns: string[];
    rows: Array<Record<string, unknown>>;
  };
  meta?: Record<string, unknown>;
};

const ALLOWED_COLLECTIONS = new Set([
  'orders',
  'quotes',
  'customers',
  'notifications',
  'products',
  'categories',
  'userProfiles',
  'auditLogs',
  'orderPreparations'
]);

function normalize(value: unknown): string {
  return String(value || '').toLowerCase().trim();
}

function contains(value: unknown, query: string): boolean {
  return normalize(value).includes(query);
}

function toRows(items: any[], fields?: string[]) {
  if (items.length === 0) return { columns: [], rows: [] as Array<Record<string, unknown>> };
  const columns = fields && fields.length > 0 ? fields : Object.keys(items[0]).slice(0, 8);
  const rows = items.map((item) => {
    const row: Record<string, unknown> = {};
    columns.forEach((column) => {
      const value = item[column];
      row[column] = typeof value === 'object' && value && typeof value.toDate === 'function'
        ? value.toDate().toISOString()
        : value;
    });
    return row;
  });
  return { columns, rows };
}

async function executeCollectionQuery(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const collection = typeof input.collection === 'string' ? input.collection : '';
  const query = typeof input.query === 'string' ? input.query.trim().toLowerCase() : '';
  const limit = typeof input.limit === 'number' ? Math.min(Math.max(input.limit, 1), 100) : 20;
  const fields = Array.isArray(input.fields) ? input.fields.filter((v): v is string => typeof v === 'string') : undefined;

  if (!ALLOWED_COLLECTIONS.has(collection)) {
    throw new Error(`Coleccion no permitida: ${collection}`);
  }

  const snapshot = await collectionRef(collection).limit(500).get();
  let items = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }));
  if (query) {
    items = items.filter((item) =>
      Object.values(item).some((value) => {
        if (typeof value === 'string' || typeof value === 'number') return contains(value, query);
        return false;
      })
    );
  }
  const sliced = items.slice(0, limit);
  const table = toRows(sliced, fields);
  return {
    tool: 'collection_query',
    summary: `${sliced.length} resultados en ${collection}`,
    table,
    meta: { collection, query, totalRows: sliced.length }
  };
}

async function executeSearchCatalog(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const query = typeof input.query === 'string' ? input.query.trim().toLowerCase() : '';
  const limit = typeof input.limit === 'number' ? Math.min(Math.max(input.limit, 1), 100) : 20;
  const [productsSnapshot, categoriesSnapshot] = await Promise.all([
    collectionRef('products').limit(1000).get(),
    collectionRef('categories').limit(500).get()
  ]);
  const categories: any[] = categoriesSnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }));
  const categoryNameById = new Map(categories.map((category) => [String(category.id), String(category.name || '')]));
  const items: Array<Record<string, unknown>> = (productsSnapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }))
    .filter((product: any) => product.isActive !== false)
    .filter((product: any) =>
      contains(product.name, query) ||
      contains(product.brand, query) ||
      contains(product.code, query) ||
      contains(categoryNameById.get(String(product.categoryId || '')), query)
    )
    .slice(0, limit)
    .map((product: any) => ({
      id: product.id,
      name: product.name,
      brand: product.brand,
      code: product.code,
      categoryName: categoryNameById.get(String(product.categoryId || '')) || null
    }))) as Array<Record<string, unknown>>;

  return {
    tool: 'search_catalog',
    summary: `${items.length} productos encontrados`,
    table: {
      columns: ['id', 'name', 'brand', 'code', 'categoryName'],
      rows: items
    },
    meta: { query, totalRows: items.length, sources: ['products', 'categories'] }
  };
}

async function executeAdminKpis(): Promise<ToolExecutionResult> {
  const { orders } = await readDashboardCollections();
  const summary = computeExecutiveSummary(orders);
  return {
    tool: 'get_admin_kpis',
    summary: 'KPIs ejecutivos calculados',
    table: {
      columns: ['metric', 'value'],
      rows: [
        { metric: 'revenueMonth', value: summary.revenueMonth },
        { metric: 'ordersMonth', value: summary.ordersMonth },
        { metric: 'averageTicket', value: summary.averageTicket },
        { metric: 'fulfillmentRate', value: summary.fulfillmentRate }
      ]
    },
    meta: { period: summary.period, totalRows: 4, sources: ['orders'] }
  };
}

async function executeAdminClients(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const limit = typeof input.limit === 'number' ? Math.min(Math.max(input.limit, 1), 100) : 10;
  const { orders } = await readDashboardCollections();
  const items = computeTopClients(orders, limit);
  return {
    tool: 'get_admin_clients',
    summary: `${items.length} clientes principales`,
    table: {
      columns: ['customerName', 'organization', 'orderCount', 'totalInvoiced'],
      rows: items
    },
    meta: { totalRows: items.length, sources: ['orders'] }
  };
}

async function executeAdminOperations(): Promise<ToolExecutionResult> {
  const [{ orders, quotes, preparations }, inactiveUsers] = await Promise.all([
    readDashboardCollections(),
    countInactiveUsers()
  ]);
  const metrics = computeOperationalControl(orders, quotes, preparations, inactiveUsers);
  return {
    tool: 'get_admin_operations',
    summary: 'Control operativo consolidado',
    table: {
      columns: Object.keys(metrics),
      rows: [metrics]
    },
    meta: { totalRows: 1, sources: ['orders', 'quotes', 'orderPreparations', 'users'] }
  };
}

async function executeNotifications(input: Record<string, unknown>): Promise<ToolExecutionResult> {
  const limit = typeof input.limit === 'number' ? Math.min(Math.max(input.limit, 1), 100) : 20;
  const unreadOnly = input.unreadOnly === true;
  const items = await listNotifications(limit, unreadOnly);
  return {
    tool: 'get_notifications',
    summary: `${items.length} notificaciones listadas`,
    table: {
      columns: ['id', 'userId', 'title', 'type', 'read'],
      rows: items.map((item: any) => ({
        id: item.id,
        userId: item.userId,
        title: item.title,
        type: item.type,
        read: item.read
      }))
    },
    meta: { totalRows: items.length, unreadOnly, sources: ['notifications'] }
  };
}

export async function executeToolCall(toolCall: ClawbotToolCall): Promise<ToolExecutionResult> {
  switch (toolCall.tool) {
    case 'collection_query':
      return executeCollectionQuery(toolCall.input);
    case 'search_catalog':
      return executeSearchCatalog(toolCall.input);
    case 'get_admin_kpis':
      return executeAdminKpis();
    case 'get_admin_clients':
      return executeAdminClients(toolCall.input);
    case 'get_admin_operations':
      return executeAdminOperations();
    case 'get_notifications':
      return executeNotifications(toolCall.input);
    default:
      throw new Error(`Tool no soportada: ${toolCall.tool}`);
  }
}
