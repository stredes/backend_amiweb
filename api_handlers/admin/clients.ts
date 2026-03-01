import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, requireRole } from '../../src/middleware/auth';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import { handleError } from '../../src/utils/errorHandler';
import { fail, ok } from '../../src/utils/responses';
import { computeTopClients } from '../../src/utils/adminDashboard';
import { readDashboardCollections } from './_shared';

function parseLimit(rawLimit: unknown, defaultValue = 20) {
  if (typeof rawLimit !== 'string') return defaultValue;
  const value = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(value)) return defaultValue;
  return Math.min(Math.max(value, 1), 100);
}

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

    const limit = parseLimit(req.query.limit, 20);
    const { orders } = await readDashboardCollections();
    const items = computeTopClients(orders, limit);

    requestLogger.end(200);
    return ok(res, {
      items,
      total: items.length
    });
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/admin/clients',
      method: req.method
    });
  }
}
