import { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef } from '../../src/lib/firestore';
import { ok, fail } from '../../src/utils/responses';
import { requireAuth, requireWarehouse } from '../../src/middleware/auth';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import { logger } from '../../src/utils/logger';
import { handleError } from '../../src/utils/errorHandler';
import { WarehouseStats } from '../../src/models/orderPreparation';

/**
 * API para estadísticas de bodega
 * GET /api/warehouse/stats - Obtener estadísticas del dashboard de bodega
 * GET /api/warehouse/stats?byUser=true - Obtener estadísticas por usuario
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);

  try {
    // Verificar autenticación
    const isAuthenticated = await requireAuth(req, res);
    if (!isAuthenticated) return;

    // GET: Obtener estadísticas
    if (req.method === 'GET') {
      // Verificar permisos de bodega
      if (!requireWarehouse(req, res)) return;

      const byUser = req.query.byUser === 'true';

      // Si se solicitan estadísticas por usuario
      if (byUser) {
        const { getWarehouseLoadStats, suggestRebalancing } = await import('../../src/utils/warehouseAssignment');
        
        logger.debug('Consultando estadísticas de carga por usuario');

        const userLoads = await getWarehouseLoadStats();
        const rebalancing = await suggestRebalancing();

        logger.info('Estadísticas por usuario consultadas', {
          userCount: userLoads.length,
          needsRebalancing: rebalancing.needsRebalancing
        });

        requestLogger.end(200);
        return ok(res, {
          users: userLoads,
          rebalancing,
          totalUsers: userLoads.length,
          totalActiveOrders: userLoads.reduce((sum, u) => sum + u.activeOrders, 0),
          totalItems: userLoads.reduce((sum, u) => sum + u.totalItems, 0),
          averageLoadScore: userLoads.length > 0
            ? userLoads.reduce((sum, u) => sum + u.loadScore, 0) / userLoads.length
            : 0
        });
      }

      logger.debug('Consultando estadísticas de bodega');

      // Obtener órdenes de hoy
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Contar órdenes por estado
      const [pendingSnapshot, processingSnapshot, completedSnapshot] = await Promise.all([
        collectionRef('orders')
          .where('status', '==', 'confirmado')
          .get(),
        collectionRef('orders')
          .where('status', '==', 'procesando')
          .get(),
        collectionRef('orderPreparations')
          .where('status', '==', 'despachado')
          .get()
      ]);

      // Contar preparaciones por estado
      const [preparationsSnapshot] = await Promise.all([
        collectionRef('orderPreparations').get()
      ]);

      const preparationsByStatus = {
        pending: 0,
        assigned: 0,
        inProgress: 0,
        prepared: 0,
        dispatched: 0
      };

      preparationsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        switch (data.status) {
          case 'pendiente':
            preparationsByStatus.pending++;
            break;
          case 'asignado':
            preparationsByStatus.assigned++;
            break;
          case 'en_preparacion':
            preparationsByStatus.inProgress++;
            break;
          case 'preparado':
            preparationsByStatus.prepared++;
            break;
          case 'despachado':
            preparationsByStatus.dispatched++;
            break;
        }
      });

      // Calcular tiempo promedio de preparación (simplificado)
      let totalPreparationTime = 0;
      let countWithTime = 0;

      preparationsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.startedAt && data.completedAt) {
          const startTime = data.startedAt.toDate();
          const endTime = data.completedAt.toDate();
          const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60); // minutos
          totalPreparationTime += duration;
          countWithTime++;
        }
      });

      const averagePreparationTime = countWithTime > 0
        ? Math.round(totalPreparationTime / countWithTime)
        : 0;

      const stats: WarehouseStats = {
        ordersToday: 0, // TODO: filtrar por fecha
        ordersPending: pendingSnapshot.size,
        ordersInProgress: processingSnapshot.size,
        ordersCompleted: completedSnapshot.size,
        averagePreparationTime
      };

      logger.info('Estadísticas de bodega consultadas', stats);
      requestLogger.end(200);
      return ok(res, stats);
    }

    logger.warn('Método no permitido', { method: req.method });
    requestLogger.end(405);
    return fail(res, 'Método no permitido', 405);

  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/warehouse/stats',
      method: req.method
    });
  }
}
