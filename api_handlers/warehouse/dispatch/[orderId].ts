import { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef, nowTimestamp } from '../../../src/lib/firestore';
import { ok, fail } from '../../../src/utils/responses';
import { requireAuth, requireWarehouse } from '../../../src/middleware/auth';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import { logger } from '../../../src/utils/logger';
import { handleError } from '../../../src/utils/errorHandler';

/**
 * API para despacho de pedidos
 * POST /api/warehouse/dispatch/[orderId] - Despachar pedido preparado
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

    // POST: Despachar pedido
    if (req.method === 'POST') {
      logger.debug('Despachando pedido', { orderId, userId: user.uid });

      const { carrier, trackingNumber, notes } = req.body;

      // Verificar que el pedido existe
      const orderDoc = await collectionRef('orders').doc(orderId).get();
      if (!orderDoc.exists) {
        requestLogger.end(404);
        return fail(res, 'Orden no encontrada', 404);
      }

      // Verificar que tiene registro de preparación
      const prepDoc = await collectionRef('orderPreparations').doc(orderId).get();
      if (!prepDoc.exists) {
        requestLogger.end(400);
        return fail(res, 'Pedido no tiene registro de preparación', 400);
      }

      const prepData = prepDoc.data();
      if (!prepData) {
        requestLogger.end(500);
        return fail(res, 'Registro de preparación inválido', 500);
      }

      // Verificar que está preparado
      if (prepData.status !== 'preparado') {
        requestLogger.end(400);
        return fail(res, `Pedido no está preparado (estado: ${prepData.status})`, 400);
      }

      // Actualizar preparación con datos de despacho
      await collectionRef('orderPreparations').doc(orderId).update({
        status: 'despachado',
        dispatchedBy: user.uid,
        dispatchedByName: user.email,
        dispatchedAt: nowTimestamp(),
        carrier: carrier || null,
        trackingNumber: trackingNumber || null,
        dispatchNotes: notes || null,
        updatedAt: nowTimestamp()
      });

      const updateOriginHeader = req.headers.origin || req.headers['x-origin'];
      const updateOrigin = Array.isArray(updateOriginHeader)
        ? updateOriginHeader[0]
        : updateOriginHeader || 'unknown';

      // Actualizar orden
      await collectionRef('orders').doc(orderId).update({
        status: 'enviado',
        trackingNumber: trackingNumber || null,
        shippedAt: nowTimestamp(),
        updatedAt: nowTimestamp(),
        updatedBy: user.uid,
        updateOrigin
      });

      logger.event('order.dispatched', { 
        orderId, 
        dispatchedBy: user.uid,
        carrier,
        trackingNumber
      });
      logger.info('Pedido despachado exitosamente', { 
        orderId, 
        trackingNumber 
      });

      const updatedPrep = await collectionRef('orderPreparations').doc(orderId).get();
      const updatedOrder = await collectionRef('orders').doc(orderId).get();

      requestLogger.end(200);
      return ok(res, {
        preparation: { id: updatedPrep.id, ...updatedPrep.data() },
        order: { id: updatedOrder.id, ...updatedOrder.data() }
      });
    }

    logger.warn('Método no permitido', { method: req.method });
    requestLogger.end(405);
    return fail(res, 'Método no permitido', 405);

  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: `/api/warehouse/dispatch/${orderId}`,
      method: req.method
    });
  }
}
