import assert from 'node:assert/strict';
import { getAssistantSuggestions, inferAssistantPlan } from '../src/.clawbot/planner';

function run() {
  const salesByVendor = inferAssistantPlan('Muestrame las ventas del mes por vendedor');
  assert.equal(salesByVendor?.intent, 'sales_by_vendor');

  const inactiveClients = inferAssistantPlan('Que clientes estan inactivos este mes');
  assert.equal(inactiveClients?.intent, 'inactive_clients');

  const suggestions = getAssistantSuggestions();
  assert.ok(suggestions.length >= 3);
}

run();
console.log('clawbot-service.test.ts: OK');
