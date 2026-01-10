import { VercelRequest, VercelResponse } from '@vercel/node';
import { ok, fail } from '../../../src/utils/responses';
import { requireAuth, requireWarehouse } from '../../../src/middleware/auth';
import { enableCors, handleCorsPreFlight } from '../../../src/middleware/cors';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import { logger } from '../../../src/utils/logger';
import { handleError } from '../../../src/utils/errorHandler';
import { fetchCatalogValues } from '../../../src/utils/warehouseStock';

/**
 * GET /api/warehouse/catalog/familias
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);

  try {
    enableCors(req, res);
    if (handleCorsPreFlight(req, res)) {
      return;
    }

    const isAuthenticated = await requireAuth(req, res);
    if (!isAuthenticated) return;

    if (!requireWarehouse(req, res)) return;

    if (req.method !== 'GET') {
      logger.warn('Método no permitido', { method: req.method });
      requestLogger.end(405);
      return fail(res, 'Método no permitido', 405);
    }

    const items = await fetchCatalogValues('familia');
    requestLogger.end(200);
    return ok(res, { items });
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/warehouse/catalog/familias',
      method: req.method
    });
  }
}
