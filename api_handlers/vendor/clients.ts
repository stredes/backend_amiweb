import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, requireRole } from '../../src/middleware/auth';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import { handleError } from '../../src/utils/errorHandler';
import { parsePagination } from '../../src/utils/pagination';
import { fail, ok } from '../../src/utils/responses';
import { applyVendorScope, computeVendorClientsMetrics } from '../../src/utils/vendorDashboard';
import { readVendorCollections, resolveVendorScope } from './_shared';

function parseOptionalBoolean(raw: unknown): boolean | undefined {
  if (typeof raw !== 'string') return undefined;
  if (raw.toLowerCase() === 'true') return true;
  if (raw.toLowerCase() === 'false') return false;
  return undefined;
}

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

    const { page, pageSize, offset } = parsePagination(req.query as Record<string, string>);
    const search = typeof req.query.search === 'string' ? req.query.search.toLowerCase().trim() : '';
    const isActive = parseOptionalBoolean(req.query.isActive);
    if (typeof req.query.isActive === 'string' && typeof isActive !== 'boolean') {
      requestLogger.end(400);
      return fail(res, 'isActive debe ser true o false', 400);
    }

    const { clients, orders } = await readVendorCollections();
    const scopedClients = applyVendorScope(clients, { vendorId: scope.vendorId });
    const scopedOrders = applyVendorScope(orders, { vendorId: scope.vendorId });

    let withMetrics = computeVendorClientsMetrics(scopedClients, scopedOrders);
    if (search) {
      withMetrics = withMetrics.filter((client) => {
        const values = [client.name, client.email, client.company].map((v) => (v || '').toString().toLowerCase());
        return values.some((v) => v.includes(search));
      });
    }
    if (typeof isActive === 'boolean') {
      withMetrics = withMetrics.filter((client) => {
        const active = client.status !== 'inactivo' && client.status !== 'suspendido';
        return active === isActive;
      });
    }

    const total = withMetrics.length;
    const items = withMetrics.slice(offset, offset + pageSize);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    requestLogger.end(200);
    return ok(res, {
      items,
      total,
      page,
      pageSize,
      totalPages
    });
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/vendor/clients',
      method: req.method
    });
  }
}
