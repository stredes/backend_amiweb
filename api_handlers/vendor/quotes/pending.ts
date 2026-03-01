import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, requireRole } from '../../../src/middleware/auth';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import { handleError } from '../../../src/utils/errorHandler';
import { fail, ok } from '../../../src/utils/responses';
import { applyVendorScope } from '../../../src/utils/vendorDashboard';
import { readVendorCollections, resolveVendorScope } from '../_shared';

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
    const scoped = applyVendorScope(quotes, { vendorId: scope.vendorId });
    const items = scoped
      .filter((quote) => quote.status === 'pendiente' || quote.status === 'en_revision_vendedor')
      .sort((a, b) => {
        const da = new Date((a.createdAt as any)?.toDate?.() || a.createdAt || 0).getTime();
        const db = new Date((b.createdAt as any)?.toDate?.() || b.createdAt || 0).getTime();
        return db - da;
      });

    requestLogger.end(200);
    return ok(res, {
      items,
      total: items.length
    });
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/vendor/quotes/pending',
      method: req.method
    });
  }
}
