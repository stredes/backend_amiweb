import type { ClawbotToolCall } from './types';

export function inferFallbackToolCalls(message: string): ClawbotToolCall[] {
  const text = message.toLowerCase();
  if (text.includes('kpi') || text.includes('ventas') || text.includes('ticket')) {
    return [{ tool: 'get_admin_kpis', input: {} }];
  }
  if (text.includes('cliente') || text.includes('cartera')) {
    return [{ tool: 'get_admin_clients', input: { limit: 10 } }];
  }
  if (text.includes('operacion') || text.includes('bodega') || text.includes('transito')) {
    return [{ tool: 'get_admin_operations', input: {} }];
  }
  if (text.includes('notific')) {
    return [{ tool: 'get_notifications', input: { limit: 20, unreadOnly: false } }];
  }
  if (text.includes('producto') || text.includes('categoria') || text.includes('catalog')) {
    return [{ tool: 'search_catalog', input: { query: message, limit: 20 } }];
  }
  if (text.includes('pedido') || text.includes('orden')) {
    return [{ tool: 'collection_query', input: { collection: 'orders', query: message, limit: 20 } }];
  }
  if (text.includes('cotiza')) {
    return [{ tool: 'collection_query', input: { collection: 'quotes', query: message, limit: 20 } }];
  }
  if (text.includes('usuario') || text.includes('socio') || text.includes('vendedor')) {
    return [{ tool: 'collection_query', input: { collection: 'userProfiles', query: message, limit: 20 } }];
  }
  return [{ tool: 'collection_query', input: { collection: 'orders', query: message, limit: 20 } }];
}
