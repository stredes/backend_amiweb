import { VercelRequest, VercelResponse } from '@vercel/node';
import { ok, fail } from '../../src/utils/responses';
import { requireAuth, requireWarehouse } from '../../src/middleware/auth';
import { enableCors, handleCorsPreFlight } from '../../src/middleware/cors';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import { logger } from '../../src/utils/logger';
import { handleError } from '../../src/utils/errorHandler';
import { parsePagination } from '../../src/utils/pagination';
import { fetchWarehouseStock, parseBoolean } from '../../src/utils/warehouseStock';

/**
 * API de stock físico
 * GET /api/warehouse/stock
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

    const {
      date,
      familia,
      subfamilia,
      bodega,
      ubicacion,
      codigoArticulo,
      unidadNegocio,
      marca,
      origen,
      includeTemporaryStock,
      hideNoStock,
      search
    } = req.query;

    const { page, pageSize, offset } = parsePagination(req.query as Record<string, string>);

    const { items, summary } = await fetchWarehouseStock({
      date: typeof date === 'string' ? date : undefined,
      familia: typeof familia === 'string' ? familia : undefined,
      subfamilia: typeof subfamilia === 'string' ? subfamilia : undefined,
      bodega: typeof bodega === 'string' ? bodega : undefined,
      ubicacion: typeof ubicacion === 'string' ? ubicacion : undefined,
      codigoArticulo: typeof codigoArticulo === 'string' ? codigoArticulo : undefined,
      unidadNegocio: typeof unidadNegocio === 'string' ? unidadNegocio : undefined,
      marca: typeof marca === 'string' ? marca : undefined,
      origen: typeof origen === 'string' ? origen : undefined,
      includeTemporaryStock: parseBoolean(includeTemporaryStock),
      hideNoStock: parseBoolean(hideNoStock),
      search: typeof search === 'string' ? search : undefined
    });

    const pagedItems = items.slice(offset, offset + pageSize);

    logger.info('Stock físico consultado', {
      count: pagedItems.length,
      total: items.length,
      page,
      pageSize
    });

    requestLogger.end(200);
    return ok(res, {
      items: pagedItems,
      total: items.length,
      page,
      pageSize,
      summary
    });
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/warehouse/stock',
      method: req.method
    });
  }
}
