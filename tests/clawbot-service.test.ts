import assert from 'node:assert/strict';
import { inferFallbackToolCalls } from '../src/.clawbot/planner';

function run() {
  const kpis = inferFallbackToolCalls('muestrame los kpis de ventas');
  assert.equal(kpis[0].tool, 'get_admin_kpis');

  const clients = inferFallbackToolCalls('que clientes lideran la cartera');
  assert.equal(clients[0].tool, 'get_admin_clients');

  const orders = inferFallbackToolCalls('pedidos pendientes de hoy');
  assert.equal(orders[0].tool, 'collection_query');
}

run();
console.log('clawbot-service.test.ts: OK');
