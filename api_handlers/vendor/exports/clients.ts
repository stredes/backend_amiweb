import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, requireRole } from '../../../src/middleware/auth';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import { handleError } from '../../../src/utils/errorHandler';
import { fail } from '../../../src/utils/responses';
import { applyVendorScope, computeVendorClientsMetrics } from '../../../src/utils/vendorDashboard';
import { buildCsv, readVendorCollections, resolveVendorScope } from '../_shared';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);
  try {
    const isAuthenticated = await requireAuth(req, res);
    if (!isAuthenticated) {
      requestLogger.end(401);
      return;
    }
    const isAuthorized = requireRole(req, res, ['vendedor', 'admin', 'root']);
    if (!isAuthorized) {
      requestLogger.end(403);
      return;
    }
    if (req.method !== 'GET') {
      requestLogger.end(405);
      return fail(res, 'Método no permitido', 405);
    }

    const scope = resolveVendorScope(req, res);
    if (scope.denied) {
      requestLogger.end(403);
      return;
    }

    const { clients, orders } = await readVendorCollections();
    const scopedClients = applyVendorScope(clients, { vendorId: scope.vendorId });
    const scopedOrders = applyVendorScope(orders, { vendorId: scope.vendorId });
    const rows = computeVendorClientsMetrics(scopedClients, scopedOrders).map((client) => ({
      id: client.id || '',
      name: client.name || '',
      email: client.email || '',
      company: client.company || '',
      status: client.status || '',
      totalSales: client.totalSales || 0,
      orderCount: client.orderCount || 0,
      lastOrderAt: client.lastOrderAt || ''
    }));

    const csv = buildCsv(['id', 'name', 'email', 'company', 'status', 'totalSales', 'orderCount', 'lastOrderAt'], rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="vendor-clients.csv"');
    requestLogger.end(200);
    return res.status(200).send(csv);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/vendor/exports/clients.csv',
      method: req.method
    });
  }
}
