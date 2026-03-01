import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, requireRole } from '../../src/middleware/auth';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import { handleError } from '../../src/utils/errorHandler';
import { fail, ok } from '../../src/utils/responses';
import { applyVendorScope, computeVendorPipeline } from '../../src/utils/vendorDashboard';
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

    const { quotes } = await readVendorCollections();
    const scopedQuotes = applyVendorScope(quotes, { vendorId: scope.vendorId });
    const data = computeVendorPipeline(scopedQuotes);

    requestLogger.end(200);
    return ok(res, data);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/vendor/pipeline',
      method: req.method
    });
  }
}
