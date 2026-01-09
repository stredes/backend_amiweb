import { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef, nowTimestamp } from '../../../src/lib/firestore';
import { ok, fail } from '../../../src/utils/responses';
import { requireAuth, requireWarehouse } from '../../../src/middleware/auth';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import { logger } from '../../../src/utils/logger';
import { handleError } from '../../../src/utils/errorHandler';
import { OrderPreparation, OrderPreparationItem } from '../../../src/models/orderPreparation';

/**
 * API para preparación de pedidos individuales
 * GET /api/warehouse/prepare/[orderId] - Obtener detalles de preparación
 * POST /api/warehouse/prepare/[orderId] - Asignar preparador y crear registro
 * PATCH /api/warehouse/prepare/[orderId] - Actualizar progreso de preparación
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);
  const { orderId } = req.query;

  if (!orderId || Array.isArray(orderId)) {
    requestLogger.end(400);
    return fail(res, 'ID de orden inválido', 400);
  }

  try {
    // Verificar autenticación
    const isAuthenticated = await requireAuth(req, res);
    if (!isAuthenticated) return;

    // Verificar permisos de bodega
    if (!requireWarehouse(req, res)) return;

    const user = (req as any).user;

    // GET: Obtener detalles de preparación
    if (req.method === 'GET') {
      logger.debug('Consultando preparación de pedido', { orderId });

      const orderDoc = await collectionRef('orders').doc(orderId).get();
      if (!orderDoc.exists) {
        requestLogger.end(404);
        return fail(res, 'Orden no encontrada', 404);
      }

      const prepDoc = await collectionRef('orderPreparations').doc(orderId).get();

      requestLogger.end(200);
      return ok(res, {
        order: { id: orderDoc.id, ...orderDoc.data() },
        preparation: prepDoc.exists ? { id: prepDoc.id, ...prepDoc.data() } : null
      });
    }

    // POST: Asignar preparador y crear registro de preparación
    if (req.method === 'POST') {
      logger.debug('Asignando preparador a pedido', { orderId, userId: user.uid });

      // Verificar que la orden existe y está confirmada
      const orderDoc = await collectionRef('orders').doc(orderId).get();
      if (!orderDoc.exists) {
        requestLogger.end(404);
        return fail(res, 'Orden no encontrada', 404);
      }

      const orderData = orderDoc.data();
      if (!orderData) {
        requestLogger.end(500);
        return fail(res, 'Orden inválida', 500);
      }
      if (orderData.status !== 'confirmado' && orderData.status !== 'procesando') {
        requestLogger.end(400);
        return fail(res, 'Orden no está en estado confirmado', 400);
      }

      // Verificar si ya tiene preparación asignada
      const prepDoc = await collectionRef('orderPreparations').doc(orderId).get();
      const prepData = prepDoc.data();
      if (prepDoc.exists && prepData && prepData.status !== 'pendiente') {
        requestLogger.end(400);
        return fail(res, 'Orden ya tiene preparador asignado', 400);
      }

      // Crear items de preparación
      const items: OrderPreparationItem[] = (orderData.items || []).map((item: any) => ({
        productId: item.productId,
        productName: item.productName,
        quantityOrdered: item.quantity,
        quantityPrepared: 0,
        notes: item.notes,
        isPrepared: false
      }));

      const preparation: Omit<OrderPreparation, 'id'> = {
        orderId,
        orderNumber: orderData.orderNumber,
        status: 'asignado',
        assignedTo: user.uid,
        assignedToName: user.email,
        assignedAt: nowTimestamp(),
        items,
        totalItems: items.length,
        preparedItems: 0,
        progress: 0,
        createdAt: nowTimestamp(),
        updatedAt: nowTimestamp()
      };

      await collectionRef('orderPreparations').doc(orderId).set(preparation);

      const updateOriginHeader = req.headers.origin || req.headers['x-origin'];
      const updateOrigin = Array.isArray(updateOriginHeader)
        ? updateOriginHeader[0]
        : updateOriginHeader || 'unknown';

      // Actualizar estado de la orden
      await collectionRef('orders').doc(orderId).update({
        status: 'procesando',
        updatedAt: nowTimestamp(),
        updatedBy: user.uid,
        updateOrigin
      });

      logger.event('order.assigned_to_warehouse', { orderId, assignedTo: user.uid });
      logger.info('Preparador asignado exitosamente', { orderId, assignedTo: user.uid });

      requestLogger.end(201);
      return ok(res, { id: orderId, ...preparation }, 201);
    }

    // PATCH: Actualizar progreso de preparación
    if (req.method === 'PATCH') {
      logger.debug('Actualizando preparación de pedido', { orderId, body: req.body });

      const prepDoc = await collectionRef('orderPreparations').doc(orderId).get();
      if (!prepDoc.exists) {
        requestLogger.end(404);
        return fail(res, 'Registro de preparación no encontrado', 404);
      }

      const { items, notes } = req.body;

      if (!items || !Array.isArray(items)) {
        requestLogger.end(400);
        return fail(res, 'Items inválidos', 400);
      }

      // Calcular progreso
      const preparedCount = items.filter((item: OrderPreparationItem) => item.isPrepared).length;
      const progress = Math.round((preparedCount / items.length) * 100);
      const allPrepared = preparedCount === items.length;

      const updates: any = {
        items,
        preparedItems: preparedCount,
        progress,
        updatedAt: nowTimestamp()
      };

      // Si es la primera actualización, marcar como "en_preparacion"
      const existingPrep = prepDoc.data();
      if (existingPrep && existingPrep.status === 'asignado') {
        updates.status = 'en_preparacion';
        updates.startedAt = nowTimestamp();
      }

      // Si todo está preparado, marcar como "preparado"
      if (allPrepared) {
        updates.status = 'preparado';
        updates.completedAt = nowTimestamp();
      }

      if (notes) {
        updates.preparationNotes = notes;
      }

      await collectionRef('orderPreparations').doc(orderId).update(updates);

      logger.event('order.preparation_updated', { 
        orderId, 
        progress, 
        status: updates.status 
      });
      logger.info('Preparación actualizada', { orderId, progress });

      const updatedPrep = await collectionRef('orderPreparations').doc(orderId).get();
      requestLogger.end(200);
      return ok(res, { id: updatedPrep.id, ...updatedPrep.data() });
    }

    logger.warn('Método no permitido', { method: req.method });
    requestLogger.end(405);
    return fail(res, 'Método no permitido', 405);

  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: `/api/warehouse/prepare/${orderId}`,
      method: req.method
    });
  }
}
