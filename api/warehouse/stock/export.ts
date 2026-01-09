import { VercelRequest, VercelResponse } from '@vercel/node';
import { fail } from '../../../src/utils/responses';
import { requireAuth, requireWarehouse } from '../../../src/middleware/auth';
import { enableCors, handleCorsPreFlight } from '../../../src/middleware/cors';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import { logger } from '../../../src/utils/logger';
import { handleError } from '../../../src/utils/errorHandler';
import { fetchWarehouseStock, parseBoolean } from '../../../src/utils/warehouseStock';
import * as XLSX from 'xlsx';

/**
 * Export de stock físico
 * GET /api/warehouse/stock/export?format=csv|xlsx
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
      search,
      format
    } = req.query;

    const { items } = await fetchWarehouseStock({
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

    const safeFormat = typeof format === 'string' ? format.toLowerCase() : 'csv';

    if (safeFormat === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(items);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="stock-fisico.xlsx"');
      requestLogger.end(200);
      return res.status(200).send(buffer);
    }

    if (safeFormat !== 'csv') {
      requestLogger.end(400);
      return fail(res, 'Formato inválido. Use csv o xlsx', 400);
    }

    const headers = Object.keys(items[0] || {});
    const lines = [headers.join(',')];

    items.forEach(item => {
      const row = headers.map(key => {
        const value = (item as any)[key];
        if (value === null || value === undefined) return '';
        const text = String(value).replace(/"/g, '""');
        return `"${text}"`;
      });
      lines.push(row.join(','));
    });

    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="stock-fisico.csv"');

    requestLogger.end(200);
    return res.status(200).send(csv);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/warehouse/stock/export',
      method: req.method
    });
  }
}
