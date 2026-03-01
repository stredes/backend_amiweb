import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, requireRole } from '../../../src/middleware/auth';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import { handleError } from '../../../src/utils/errorHandler';
import { fail } from '../../../src/utils/responses';
import { computeTopClients } from '../../../src/utils/adminDashboard';
import { buildCsv, readDashboardCollections } from '../_shared';

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

    const { orders } = await readDashboardCollections();
    const top = computeTopClients(orders, 500);

    const csv = buildCsv(
      ['customerKey', 'customerName', 'organization', 'orderCount', 'totalInvoiced'],
      top as Array<Record<string, unknown>>
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=\"admin-clients-portfolio.csv\"');
    requestLogger.end(200);
    return res.status(200).send(csv);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/admin/exports/clients',
      method: req.method
    });
  }
}
