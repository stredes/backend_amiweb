import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, requireRole } from '../../src/middleware/auth';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import { handleError } from '../../src/utils/errorHandler';
import { parsePagination } from '../../src/utils/pagination';
import { fail, ok } from '../../src/utils/responses';
import { applyVendorScope, mapVendorOrders, parseDateRange } from '../../src/utils/vendorDashboard';
import { readVendorCollections, resolveVendorScope } from './_shared';

function parseStatusFilter(raw: unknown): string[] {
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === 'object' && value && typeof (value as any).toDate === 'function') {
    return (value as any).toDate();
  }
  const d = new Date(value as any);
  if (Number.isNaN(d.getTime())) return null;
  return d;
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
    const statuses = parseStatusFilter(req.query.status);
    const { from, to } = parseDateRange(req.query as Record<string, unknown>);

    const { orders, quotes } = await readVendorCollections();
    const scopedOrders = applyVendorScope(orders, { vendorId: scope.vendorId });
    const scopedQuotes = applyVendorScope(quotes, { vendorId: scope.vendorId });
    const quoteMap = new Map(scopedQuotes.map((quote) => [quote.id, quote]));

    let items = mapVendorOrders(scopedOrders, quoteMap);
    items = items.filter((order) => {
      const createdAt = toDate(order.createdAt);
      if (!createdAt) return false;
      return createdAt.getTime() >= from.getTime() && createdAt.getTime() <= to.getTime();
    });

    if (statuses.length > 0) {
      items = items.filter((order) =>
        statuses.includes(order.status || '') ||
        statuses.includes(order.quoteStatus || '') ||
        statuses.includes(order.commercialStatus || '')
      );
    }

    items.sort((a, b) => {
      const da = toDate(a.createdAt)?.getTime() || 0;
      const db = toDate(b.createdAt)?.getTime() || 0;
      return db - da;
    });

    const total = items.length;
    const paginated = items.slice(offset, offset + pageSize);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    requestLogger.end(200);
    return ok(res, {
      items: paginated,
      total,
      page,
      pageSize,
      totalPages
    });
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/vendor/orders',
      method: req.method
    });
  }
}
