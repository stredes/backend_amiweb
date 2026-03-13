import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, requireRole } from '../../../src/middleware/auth';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import { fail, ok } from '../../../src/utils/responses';
import { handleError } from '../../../src/utils/errorHandler';
import { collectionRef } from '../../../src/lib/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);
  try {
    const isAuthenticated = await requireAuth(req, res);
    if (!isAuthenticated) {
      requestLogger.end(401);
      return;
    }
    const isAuthorized = requireRole(req, res, ['admin', 'root']);
    if (!isAuthorized) {
      requestLogger.end(403);
      return;
    }
    if (req.method !== 'GET') {
      requestLogger.end(405);
      return fail(res, 'Método no permitido', 405);
    }

    const limitRaw = typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : 20;
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20;
    const snapshot = await collectionRef('assistantQueries').orderBy('createdAt', 'desc').limit(limit).get();
    const items = snapshot.docs.map((doc: any) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        question: data.question || '',
        queryLabel: data.queryLabel || '',
        requestId: data.requestId || null,
        createdAt: typeof data.createdAt?.toDate === 'function' ? data.createdAt.toDate().toISOString() : null
      };
    });

    requestLogger.end(200);
    return ok(res, { items, total: items.length });
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/admin/assistant/history',
      method: req.method
    });
  }
}
