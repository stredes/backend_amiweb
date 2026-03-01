import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, requireRole } from '../../src/middleware/auth';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import { handleError } from '../../src/utils/errorHandler';
import { fail, ok } from '../../src/utils/responses';
import { applyVendorScope, computeVendorKpis, parseDateRange } from '../../src/utils/vendorDashboard';
import { readVendorCollections, resolveVendorScope } from './_shared';

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

    const { quotes, orders, clients } = await readVendorCollections();
    const scopedQuotes = applyVendorScope(quotes, { vendorId: scope.vendorId });
    const scopedOrders = applyVendorScope(orders, { vendorId: scope.vendorId });
    const scopedClients = applyVendorScope(clients, { vendorId: scope.vendorId });
    const { from, to } = parseDateRange(req.query as Record<string, unknown>);
    const commissionRate = Number.parseFloat(process.env.VENDOR_COMMISSION_RATE || '0.05');

    const data = computeVendorKpis(scopedQuotes, scopedOrders, scopedClients, {
      dateFrom: from,
      dateTo: to,
      commissionRate: Number.isFinite(commissionRate) ? commissionRate : 0.05
    });

    requestLogger.end(200);
    return ok(res, data);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/vendor/kpis',
      method: req.method
    });
  }
}
