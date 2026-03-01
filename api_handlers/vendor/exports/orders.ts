import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, requireRole } from '../../../src/middleware/auth';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import { handleError } from '../../../src/utils/errorHandler';
import { fail } from '../../../src/utils/responses';
import { applyVendorScope, mapVendorOrders } from '../../../src/utils/vendorDashboard';
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

    const { orders, quotes } = await readVendorCollections();
    const scopedOrders = applyVendorScope(orders, { vendorId: scope.vendorId });
    const scopedQuotes = applyVendorScope(quotes, { vendorId: scope.vendorId });
    const mapped = mapVendorOrders(scopedOrders, new Map(scopedQuotes.map((q) => [q.id, q])));

    const rows = mapped.map((order) => ({
      id: order.id || '',
      orderNumber: order.orderNumber || '',
      customerName: order.customerName || '',
      customerEmail: order.customerEmail || '',
      organization: order.organization || '',
      status: order.status || '',
      quoteStatus: order.quoteStatus || '',
      commercialStatus: order.commercialStatus || '',
      total: order.total || 0,
      createdAt:
        typeof (order.createdAt as any)?.toDate === 'function'
          ? (order.createdAt as any).toDate().toISOString()
          : order.createdAt || ''
    }));

    const csv = buildCsv(
      ['id', 'orderNumber', 'customerName', 'customerEmail', 'organization', 'status', 'quoteStatus', 'commercialStatus', 'total', 'createdAt'],
      rows
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="vendor-orders.csv"');
    requestLogger.end(200);
    return res.status(200).send(csv);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/vendor/exports/orders.csv',
      method: req.method
    });
  }
}
