import assert from 'node:assert/strict';
import {
  canTransitionOrderStatus,
  evaluateOrderWorkflowChecklist,
  type WorkflowOrderLike,
  type WorkflowPreparationLike
} from '../src/utils/workflowCycle';

function runTransitionTests() {
  assert.equal(canTransitionOrderStatus('pendiente', 'confirmado', 'admin'), true);
  assert.equal(canTransitionOrderStatus('pendiente', 'enviado', 'admin'), false);
  assert.equal(canTransitionOrderStatus('enviado', 'entregado', 'cliente', true), true);
  assert.equal(canTransitionOrderStatus('enviado', 'entregado', 'bodega'), false);
}

function runChecklistTests() {
  const order: WorkflowOrderLike = {
    id: 'ord-1',
    status: 'enviado',
    paymentStatus: 'pagado',
    items: [{ productId: 'p1', quantity: 2 }],
    quoteId: 'q-1'
  };

  const prep: WorkflowPreparationLike = {
    status: 'despachado',
    progress: 100,
    inspectionStatus: 'approved',
    adminApprovalStatus: 'approved'
  };

  const result = evaluateOrderWorkflowChecklist(order, prep, true);
  assert.equal(result.isHealthy, true);
  assert.equal(result.issues.length, 0);

  const broken = evaluateOrderWorkflowChecklist(
    { ...order, status: 'enviado', paymentStatus: 'pendiente' },
    { ...prep, inspectionStatus: 'pending' },
    false
  );

  assert.equal(broken.isHealthy, false);
  assert.ok(broken.issues.length >= 2);
}

runTransitionTests();
runChecklistTests();
console.log('workflow-cycle.test.ts: OK');
