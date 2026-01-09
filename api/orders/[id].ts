import { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef, nowTimestamp } from '../../src/lib/firestore';
import { ok, fail } from '../../src/utils/responses';
import { updateOrderSchema } from '../../src/validation/orderSchema';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import { requireAuth } from '../../src/middleware/auth';
import { logger } from '../../src/utils/logger';
import { handleError } from '../../src/utils/errorHandler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);
  const { id } = req.query;

  if (!id || Array.isArray(id)) {
    requestLogger.end(400);
    return fail(res, 'ID de orden inválido', 400);
  }

  try {
    const docRef = collectionRef('orders').doc(id);

    // GET: Obtener una orden específica
    if (req.method === 'GET') {
      logger.debug('Consultando orden', { orderId: id });

      const dbStart = Date.now();
      const doc = await docRef.get();
      const dbDuration = Date.now() - dbStart;
      
      logger.database('read', 'orders', true, dbDuration);

      if (!doc.exists) {
        logger.warn('Orden no encontrada', { orderId: id });
        requestLogger.end(404);
        return fail(res, 'Orden no encontrada', 404);
      }

      logger.info('Orden consultada exitosamente', { orderId: id });
      requestLogger.end(200);
      return ok(res, { id: doc.id, ...doc.data() });
    }

    // PATCH: Actualizar una orden
    if (req.method === 'PATCH') {
      logger.debug('Actualizando orden', { orderId: id, body: req.body });

      const isAuthenticated = await requireAuth(req, res);
      if (!isAuthenticated) return;

      const parsed = updateOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        logger.warn('Validación de actualización fallida', { errors: parsed.error.errors });
        requestLogger.end(400);
        return fail(res, 'Datos de actualización inválidos', 400, parsed.error.errors);
      }

      const { confirmDelivery, ...updates } = parsed.data;
      const user = (req as any).user;
      const userRole = user?.role;
      const updateOriginHeader = req.headers.origin || req.headers['x-origin'];
      const updateOrigin = Array.isArray(updateOriginHeader)
        ? updateOriginHeader[0]
        : updateOriginHeader || 'unknown';

      if (userRole === 'bodega') {
        const updateKeys = Object.keys(updates);
        const onlyStatusUpdate = updateKeys.length === 1 && updateKeys[0] === 'status';
        if (!onlyStatusUpdate || updates.status !== 'procesando') {
          logger.warn('Actualización denegada para bodega', {
            orderId: id,
            userId: user?.uid,
            updates: updateKeys
          });
          requestLogger.end(403);
          return fail(res, 'Solo puede iniciar preparación (estado procesando)', 403);
        }
      }

      if (updates.status === 'entregado' && !confirmDelivery) {
        logger.warn('Confirmación de entrega requerida', { orderId: id });
        requestLogger.end(403);
        return fail(res, 'La entrega solo puede ser confirmada por el cliente', 403);
      }

      // Verificar que la orden existe
      const doc = await docRef.get();
      if (!doc.exists) {
        logger.warn('Orden no encontrada para actualizar', { orderId: id });
        requestLogger.end(404);
        return fail(res, 'Orden no encontrada', 404);
      }

      const currentData = doc.data();
      if (!currentData) {
        logger.warn('Orden inválida para actualizar', { orderId: id });
        requestLogger.end(500);
        return fail(res, 'Orden inválida', 500);
      }

      if (confirmDelivery) {
        if (userRole === 'bodega' || userRole === 'admin' || userRole === 'vendedor' || userRole === 'root') {
          logger.warn('Confirmación de entrega denegada por rol', { orderId: id, userId: user?.uid, role: userRole });
          requestLogger.end(403);
          return fail(res, 'Solo el cliente puede confirmar la entrega', 403);
        }

        if (currentData.userId && user?.uid !== currentData.userId) {
          logger.warn('Confirmación de entrega denegada por usuario', { orderId: id, userId: user?.uid });
          requestLogger.end(403);
          return fail(res, 'No autorizado para confirmar esta entrega', 403);
        }

        if (currentData.customerEmail && user?.email && user.email !== currentData.customerEmail) {
          logger.warn('Confirmación de entrega denegada por email', { orderId: id, userId: user?.uid });
          requestLogger.end(403);
          return fail(res, 'No autorizado para confirmar esta entrega', 403);
        }

        if (currentData.status === 'entregado') {
          requestLogger.end(200);
          return ok(res, { id: doc.id, ...currentData });
        }
        if (currentData.status !== 'enviado') {
          logger.warn('No se puede confirmar entrega', { orderId: id, currentStatus: currentData.status });
          requestLogger.end(400);
          return fail(res, 'La orden no está en estado enviado', 400);
        }
        updates.status = 'entregado';
      }

      // Agregar timestamps según el estado
      const timestampUpdates: any = {
        updatedAt: nowTimestamp()
      };
      const statusChange = Boolean(updates.status) || Boolean(confirmDelivery);
      if (statusChange) {
        timestampUpdates.updatedBy = user?.uid || null;
        timestampUpdates.updateOrigin = updateOrigin;
      }

      if (updates.status === 'confirmado' && !currentData.confirmedAt) {
        timestampUpdates.confirmedAt = nowTimestamp();
      }
      if (updates.status === 'enviado' && !currentData.shippedAt) {
        timestampUpdates.shippedAt = nowTimestamp();
      }
      if (updates.status === 'entregado' && !currentData.deliveredAt) {
        timestampUpdates.deliveredAt = nowTimestamp();
      }
      if (updates.status === 'cancelado' && !currentData.cancelledAt) {
        timestampUpdates.cancelledAt = nowTimestamp();
      }
      if (confirmDelivery) {
        timestampUpdates.deliveryConfirmedAt = nowTimestamp();
      }

      const dbStart = Date.now();
      await docRef.update({
        ...updates,
        ...timestampUpdates
      });
      const dbDuration = Date.now() - dbStart;
      
      logger.database('update', 'orders', true, dbDuration);
      logger.event('order.updated', { orderId: id, updates: Object.keys(updates) });
      logger.info('Orden actualizada exitosamente', { orderId: id });

      // Obtener datos actualizados
      const updatedDoc = await docRef.get();
      requestLogger.end(200);
      return ok(res, { id: updatedDoc.id, ...updatedDoc.data() });
    }

    // DELETE: Cancelar una orden
    if (req.method === 'DELETE') {
      logger.debug('Cancelando orden', { orderId: id });

      const doc = await docRef.get();
      if (!doc.exists) {
        logger.warn('Orden no encontrada para cancelar', { orderId: id });
        requestLogger.end(404);
        return fail(res, 'Orden no encontrada', 404);
      }

      const currentStatus = doc.data()?.status;
      if (currentStatus === 'entregado' || currentStatus === 'cancelado') {
        logger.warn('No se puede cancelar orden', { orderId: id, currentStatus });
        requestLogger.end(400);
        return fail(res, 'No se puede cancelar una orden entregada o ya cancelada', 400);
      }

      const dbStart = Date.now();
      await docRef.update({
        status: 'cancelado',
        cancelledAt: nowTimestamp(),
        updatedAt: nowTimestamp()
      });
      const dbDuration = Date.now() - dbStart;
      
      logger.database('update', 'orders', true, dbDuration);
      logger.event('order.cancelled', { orderId: id });
      logger.info('Orden cancelada exitosamente', { orderId: id });

      requestLogger.end(200);
      return ok(res, { message: 'Orden cancelada exitosamente' });
    }

    logger.warn('Método no permitido', { method: req.method });
    requestLogger.end(405);
    return fail(res, 'Método no permitido', 405);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: `/api/orders/${id}`,
      method: req.method
    });
  }
}
