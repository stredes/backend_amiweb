import { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef } from '../../../src/lib/firestore';
import { ok, fail } from '../../../src/utils/responses';
import { requireAuth, requireRole } from '../../../src/middleware/auth';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import { logger } from '../../../src/utils/logger';
import { handleError } from '../../../src/utils/errorHandler';

/**
 * GET /api/quotes/vendor/pending
 * Lista las cotizaciones pendientes de revisión para el vendedor autenticado
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);

  if (req.method !== 'GET') {
    requestLogger.end(405);
    return fail(res, 'Método no permitido', 405);
  }

  try {
    // Verificar autenticación y rol de vendedor
    const isAuthenticated = await requireAuth(req, res);
    if (!isAuthenticated) return;

    const isAuthorized = await requireRole(req, res, ['vendedor', 'admin', 'root']);
    if (!isAuthorized) return;

    const user = (req as any).user;
    const userId = user.uid;
    const userRole = user.role;

    logger.debug('Listando quotes para vendedor', { userId, userRole });

    // Construir query según rol
    let query = collectionRef('quotes')
      .where('status', 'in', ['pendiente', 'en_revision_vendedor']);

    // Si es vendedor, filtrar solo sus quotes
    if (userRole === 'vendedor') {
      query = query.where('assignedSalesRep', '==', userId);
    }

    // Ordenar por fecha de creación (más recientes primero)
    query = query.orderBy('createdAt', 'desc');

    const dbStart = Date.now();
    const snapshot = await query.get();
    const dbDuration = Date.now() - dbStart;

    logger.database('read', 'quotes', true, dbDuration);

    const quotes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    logger.info('Quotes de vendedor listadas', {
      userId,
      count: quotes.length
    });

    requestLogger.end(200);
    return ok(res, {
      quotes,
      total: quotes.length
    });
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/quotes/vendor/pending',
      method: req.method
    });
  }
}
