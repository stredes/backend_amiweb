import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, requireRole } from '../../../src/middleware/auth';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import { handleError } from '../../../src/utils/errorHandler';
import { fail } from '../../../src/utils/responses';
import { buildCsv, readDashboardCollections } from '../_shared';

function asDateText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'object' && value && typeof (value as any).toDate === 'function') {
    return (value as any).toDate().toISOString();
  }
  const date = new Date(value as any);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
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

    const { orders } = await readDashboardCollections();
    const rows = orders.map((order) => ({
      id: order.id || '',
      orderNumber: order.orderNumber || '',
      customerName: order.customerName || '',
      customerEmail: order.customerEmail || '',
      organization: order.organization || '',
      status: order.status || '',
      total: order.total || 0,
      createdAt: asDateText(order.createdAt)
    }));

    const csv = buildCsv(
      ['id', 'orderNumber', 'customerName', 'customerEmail', 'organization', 'status', 'total', 'createdAt'],
      rows
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=\"admin-orders-report.csv\"');
    requestLogger.end(200);
    return res.status(200).send(csv);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/admin/exports/orders',
      method: req.method
    });
  }
}
