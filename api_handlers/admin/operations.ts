import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, requireRole } from '../../src/middleware/auth';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import { handleError } from '../../src/utils/errorHandler';
import { fail, ok } from '../../src/utils/responses';
import { computeOperationalControl } from '../../src/utils/adminDashboard';
import { countInactiveUsers, readDashboardCollections } from './_shared';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);

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

    const [{ orders, quotes, preparations }, inactiveUsers] = await Promise.all([
      readDashboardCollections(),
      countInactiveUsers()
    ]);

    const metrics = computeOperationalControl(orders, quotes, preparations, inactiveUsers);
    requestLogger.end(200);
    return ok(res, metrics);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/admin/operations',
      method: req.method
    });
  }
}
