import assert from 'node:assert/strict';
import {
  applyVendorScope,
  buildVendorAgenda,
  computeVendorClientsMetrics,
  computeVendorKpis,
  computeVendorPipeline
} from '../src/utils/vendorDashboard';

function run() {
  const quotes = [
    { id: 'q1', assignedSalesRep: 'v1', status: 'pendiente', customerName: 'A' },
    { id: 'q2', assignedSalesRep: 'v1', status: 'aprobado', customerName: 'A' },
    { id: 'q3', assignedSalesRep: 'v2', status: 'rechazado', customerName: 'B' }
  ];
  const orders = [
    { id: 'o1', assignedSalesRep: 'v1', customerName: 'A', customerEmail: 'a@x.com', total: 100, status: 'entregado', createdAt: '2026-03-01T10:00:00.000Z' },
    { id: 'o2', assignedSalesRep: 'v1', customerName: 'A', customerEmail: 'a@x.com', total: 200, status: 'enviado', createdAt: '2026-03-02T10:00:00.000Z' },
    { id: 'o3', assignedSalesRep: 'v2', customerName: 'B', customerEmail: 'b@x.com', total: 300, status: 'cancelado', createdAt: '2026-03-03T10:00:00.000Z' }
  ];
  const clients = [
    { id: 'c1', assignedSalesRep: 'v1', name: 'A', email: 'a@x.com', status: 'activo' },
    { id: 'c2', assignedSalesRep: 'v2', name: 'B', email: 'b@x.com', status: 'activo' }
  ];

  const v1Quotes = applyVendorScope(quotes, { vendorId: 'v1' });
  const v1Orders = applyVendorScope(orders, { vendorId: 'v1' });
  const v1Clients = applyVendorScope(clients, { vendorId: 'v1' });
  assert.equal(v1Quotes.length, 2);
  assert.equal(v1Orders.length, 2);
  assert.equal(v1Clients.length, 1);

  const pipeline = computeVendorPipeline(v1Quotes);
  assert.equal(pipeline.nuevas, 1);
  assert.equal(pipeline.aprobacion, 1);

  const kpis = computeVendorKpis(v1Quotes, v1Orders, v1Clients, {
    dateFrom: new Date('2026-03-01T00:00:00.000Z'),
    dateTo: new Date('2026-03-31T23:59:59.999Z'),
    commissionRate: 0.1
  });
  assert.equal(kpis.sales, 300);
  assert.equal(kpis.commission, 30);
  assert.equal(kpis.completedOrders, 1);

  const clientMetrics = computeVendorClientsMetrics(v1Clients as any[], v1Orders as any[]);
  assert.equal(clientMetrics[0].orderCount, 2);
  assert.equal(clientMetrics[0].totalSales, 300);

  const agenda = buildVendorAgenda(v1Quotes as any[], v1Orders as any[]);
  assert.ok(agenda.summary.inTransit >= 1);
}

run();
console.log('vendor-dashboard.test.ts: OK');
