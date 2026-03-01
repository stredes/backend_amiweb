import type { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef } from '../../../src/lib/firestore';
import { requireAuth, requireRole } from '../../../src/middleware/auth';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import { handleError } from '../../../src/utils/errorHandler';
import { parsePagination } from '../../../src/utils/pagination';
import { ok, fail } from '../../../src/utils/responses';
import { paginateItems } from '../../../src/utils/userAdminPolicy';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);
  const { id } = req.query;

  if (!id || Array.isArray(id)) {
    requestLogger.end(400);
    return fail(res, 'ID inválido', 400);
  }

  try {
    const isAuthenticated = await requireAuth(req, res);
    if (!isAuthenticated) {
      requestLogger.end(401);
      return;
    }

    const isAuthorized = requireRole(req, res, ['root', 'admin']);
    if (!isAuthorized) {
      requestLogger.end(403);
      return;
    }

    if (req.method !== 'GET') {
      requestLogger.end(405);
      return fail(res, 'Método no permitido', 405);
    }

    const action = typeof req.query.action === 'string' ? req.query.action : undefined;
    let query = collectionRef('auditLogs').where('targetId', '==', id);
    if (action) {
      query = query.where('action', '==', action);
    }

    const snapshot = await query.limit(1000).get();
    const all = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a: any, b: any) => {
        const aTime = typeof a?.createdAt?.toMillis === 'function' ? a.createdAt.toMillis() : 0;
        const bTime = typeof b?.createdAt?.toMillis === 'function' ? b.createdAt.toMillis() : 0;
        return bTime - aTime;
      });

    const { page, pageSize } = parsePagination(req.query as Record<string, string>);
    const pagination = paginateItems(all, page, pageSize);

    requestLogger.end(200);
    return ok(res, {
      items: pagination.items,
      total: pagination.total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: pagination.totalPages
    });
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: `/api/users/${id}/audit`,
      method: req.method
    });
  }
}
