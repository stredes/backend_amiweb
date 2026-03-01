import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, requireRole } from '../../../src/middleware/auth';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import { handleError } from '../../../src/utils/errorHandler';
import { fail } from '../../../src/utils/responses';
import { applyVendorScope } from '../../../src/utils/vendorDashboard';
import { buildCsv, readVendorCollections, resolveVendorScope } from '../_shared';

function stageFromStatus(status?: string) {
  if (status === 'pendiente' || status === 'en_revision_vendedor') return 'nuevas';
  if (status === 'aprobado_vendedor' || status === 'en_revision_admin') return 'negociacion';
  if (status === 'aprobado' || status === 'convertida') return 'aprobacion';
  if (status === 'rechazado_vendedor' || status === 'rechazado' || status === 'vencida') return 'riesgo';
  return 'otros';
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

    const { quotes } = await readVendorCollections();
    const scopedQuotes = applyVendorScope(quotes, { vendorId: scope.vendorId });
    const rows = scopedQuotes.map((quote) => ({
      id: quote.id || '',
      quoteNumber: quote.quoteNumber || '',
      customerName: quote.customerName || '',
      customerEmail: quote.customerEmail || '',
      organization: quote.organization || '',
      status: quote.status || '',
      stage: stageFromStatus(quote.status),
      total: quote.total || 0,
      createdAt:
        typeof (quote.createdAt as any)?.toDate === 'function'
          ? (quote.createdAt as any).toDate().toISOString()
          : quote.createdAt || ''
    }));

    const csv = buildCsv(['id', 'quoteNumber', 'customerName', 'customerEmail', 'organization', 'status', 'stage', 'total', 'createdAt'], rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="vendor-pipeline.csv"');
    requestLogger.end(200);
    return res.status(200).send(csv);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/vendor/exports/pipeline.csv',
      method: req.method
    });
  }
}
