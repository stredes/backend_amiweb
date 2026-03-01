import assert from 'node:assert/strict';
import {
  computeExecutiveSummary,
  computeOperationalControl,
  computePendingApprovals,
  computeTopClients
} from '../src/utils/adminDashboard';

function run() {
  const now = new Date('2026-03-15T10:00:00.000Z');
  const orders = [
    {
      id: 'o1',
      customerEmail: 'ana@corp.com',
      customerName: 'Ana',
      organization: 'Corp',
      total: 100,
      status: 'entregado',
      createdAt: '2026-03-05T09:00:00.000Z'
    },
    {
      id: 'o2',
      customerEmail: 'ana@corp.com',
      customerName: 'Ana',
      organization: 'Corp',
      total: 300,
      status: 'enviado',
      createdAt: '2026-03-12T09:00:00.000Z'
    },
    {
      id: 'o3',
      customerEmail: 'bruno@corp.com',
      customerName: 'Bruno',
      organization: 'Lab',
      total: 200,
      status: 'pendiente',
      createdAt: '2026-02-28T09:00:00.000Z'
    }
  ];

  const summary = computeExecutiveSummary(orders, now);
  assert.equal(summary.revenueMonth, 400);
  assert.equal(summary.ordersMonth, 2);
  assert.equal(summary.averageTicket, 200);
  assert.equal(summary.fulfillmentRate, 50);

  const topClients = computeTopClients(orders, 10);
  assert.equal(topClients.length, 2);
  assert.equal(topClients[0].customerName, 'Ana');
  assert.equal(topClients[0].totalInvoiced, 400);
  assert.equal(topClients[0].orderCount, 2);

  const quotes = [{ id: 'q1', status: 'aprobado_vendedor' }, { id: 'q2', status: 'aprobado' }];
  const preps = [
    { orderId: 'o1', inspectionStatus: 'approved', adminApprovalStatus: 'pending' },
    { orderId: 'o2', inspectionStatus: 'approved', adminApprovalStatus: 'approved' }
  ];

  const ops = computeOperationalControl(orders, quotes as any[], preps as any[], 3);
  assert.equal(ops.approvalsInReview, 1);
  assert.equal(ops.pendingDispatchApproval, 1);
  assert.equal(ops.inTransit, 1);
  assert.equal(ops.inactiveUsers, 3);

  const approvals = computePendingApprovals(quotes as any[], preps as any[]);
  assert.equal(approvals.total, 2);
  assert.equal(approvals.quoteApprovals.length, 1);
  assert.equal(approvals.dispatchApprovals.length, 1);
}

run();
console.log('admin-dashboard.test.ts: OK');
