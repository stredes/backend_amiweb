import { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef, nowTimestamp } from '../../src/lib/firestore';
import { ok, fail } from '../../src/utils/responses';
import { requireAuth, requireWarehouse } from '../../src/middleware/auth';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import { logger } from '../../src/utils/logger';
import { handleError } from '../../src/utils/errorHandler';
import { OrderPreparation, PreparationStatus } from '../../src/models/orderPreparation';

/**
 * API para gestión de bodega - Listado de pedidos
 * GET /api/warehouse/orders - Listar pedidos para bodega con filtros
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);

  try {
    // Verificar autenticación
    const isAuthenticated = await requireAuth(req, res);
    if (!isAuthenticated) return;

    // GET: Listar pedidos para bodega
    if (req.method === 'GET') {
      // Verificar permisos de bodega
      if (!requireWarehouse(req, res)) return;

      const { status, assignedTo } = req.query;
      
      logger.debug('Consultando pedidos para bodega', { status, assignedTo });

      // Consultar pedidos confirmados que necesitan preparación
      let ordersQuery = collectionRef('orders')
        .where('status', 'in', ['confirmado', 'procesando'])
        .orderBy('createdAt', 'asc');

      const ordersSnapshot = await ordersQuery.get();
      
      if (ordersSnapshot.empty) {
        logger.info('No hay pedidos pendientes en bodega');
        requestLogger.end(200);
        return ok(res, { items: [], total: 0 });
      }

      // Obtener información de preparación de cada pedido
      const orderIds = ordersSnapshot.docs.map(doc => doc.id);
      const preparationPromises = orderIds.map(async (orderId) => {
        const prepDoc = await collectionRef('orderPreparations').doc(orderId).get();
        return { orderId, prep: prepDoc.exists ? prepDoc.data() : null };
      });

      const preparationsData = await Promise.all(preparationPromises);
      const preparationsMap = new Map(
        preparationsData.map(({ orderId, prep }) => [orderId, prep])
      );

      // Combinar órdenes con su información de preparación
      let items = ordersSnapshot.docs.map(doc => {
        const orderData = doc.data();
        const prepData = preparationsMap.get(doc.id);
        
        return {
          id: doc.id,
          ...orderData,
          preparation: prepData || {
            status: 'pendiente',
            progress: 0,
            preparedItems: 0,
            totalItems: orderData.items?.length || 0
          }
        };
      });

      // Filtrar por estado de preparación si se especifica
      if (status && !Array.isArray(status)) {
        items = items.filter(item => item.preparation.status === status);
      }

      // Filtrar por asignación si se especifica
      if (assignedTo && !Array.isArray(assignedTo)) {
        items = items.filter(item => item.preparation.assignedTo === assignedTo);
      }

      logger.info('Pedidos de bodega consultados exitosamente', { 
        count: items.length,
        status,
        assignedTo
      });
      
      requestLogger.end(200);
      return ok(res, {
        items,
        total: items.length
      });
    }

    logger.warn('Método no permitido', { method: req.method });
    requestLogger.end(405);
    return fail(res, 'Método no permitido', 405);
    
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/warehouse/orders',
      method: req.method
    });
  }
}
