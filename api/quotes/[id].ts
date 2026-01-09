import { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef, nowTimestamp, FieldValue } from '../../src/lib/firestore';
import { ok, fail } from '../../src/utils/responses';
import { updateQuoteSchema, quoteStatusUpdateSchema } from '../../src/validation/quoteSchema';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import { logger } from '../../src/utils/logger';
import { handleError } from '../../src/utils/errorHandler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);
  const { id } = req.query;

  if (!id || Array.isArray(id)) {
    requestLogger.end(400);
    return fail(res, 'ID de cotización inválido', 400);
  }

  try {
    const docRef = collectionRef('quotes').doc(id);

    // GET: Obtener una cotización específica
    if (req.method === 'GET') {
      logger.debug('Consultando cotización', { quoteId: id });

      const dbStart = Date.now();
      const doc = await docRef.get();
      const dbDuration = Date.now() - dbStart;
      
      logger.database('read', 'quotes', true, dbDuration);

      if (!doc.exists) {
        logger.warn('Cotización no encontrada', { quoteId: id });
        requestLogger.end(404);
        return fail(res, 'Cotización no encontrada', 404);
      }

      logger.info('Cotización consultada exitosamente', { quoteId: id });
      requestLogger.end(200);
      return ok(res, { id: doc.id, ...doc.data() });
    }

    // PATCH: Actualizar una cotización (por vendedor)
    if (req.method === 'PATCH') {
      logger.debug('Actualizando cotización', { quoteId: id, body: req.body });

      const parsed = updateQuoteSchema.safeParse(req.body);
      if (!parsed.success) {
        logger.warn('Validación de actualización fallida', { errors: parsed.error.errors });
        requestLogger.end(400);
        return fail(res, 'Datos de actualización inválidos', 400, parsed.error.errors);
      }

      const updates = parsed.data;

      // Verificar que la cotización existe
      const doc = await docRef.get();
      if (!doc.exists) {
        logger.warn('Cotización no encontrada para actualizar', { quoteId: id });
        requestLogger.end(404);
        return fail(res, 'Cotización no encontrada', 404);
      }

      // Calcular validUntil si se proporciona validDays
      const timestampUpdates: any = {
        updatedAt: nowTimestamp()
      };

      if (updates.validDays) {
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + updates.validDays);
        timestampUpdates.validUntil = FieldValue.serverTimestamp();
      }

      // Timestamps automáticos según estado
      if (updates.status === 'convertida' && !doc.data()?.convertedAt) {
        timestampUpdates.convertedAt = nowTimestamp();
      }
      if (updates.status === 'rechazado' && !doc.data()?.rejectedAt) {
        timestampUpdates.rejectedAt = nowTimestamp();
      }
      if (updates.status === 'aprobado' && !doc.data()?.approvedAt) {
        timestampUpdates.approvedAt = nowTimestamp();
      }

      const { validDays, ...restUpdates } = updates;

      const dbStart = Date.now();
      await docRef.update({
        ...restUpdates,
        ...timestampUpdates
      });
      const dbDuration = Date.now() - dbStart;
      
      logger.database('update', 'quotes', true, dbDuration);
      logger.event('quote.updated', { quoteId: id, updates: Object.keys(updates) });
      logger.info('Cotización actualizada exitosamente', { quoteId: id });

      // TODO: si status es 'enviada', enviar email al cliente

      // Obtener datos actualizados
      const updatedDoc = await docRef.get();
      requestLogger.end(200);
      return ok(res, { id: updatedDoc.id, ...updatedDoc.data() });
    }

    // PUT: Cambiar estado de cotización (aceptar/rechazar por cliente)
    if (req.method === 'PUT') {
      logger.debug('Cambiando estado de cotización', { quoteId: id, body: req.body });

      const parsed = quoteStatusUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        logger.warn('Validación de cambio de estado fallida', { errors: parsed.error.errors });
        requestLogger.end(400);
        return fail(res, 'Estado inválido', 400, parsed.error.errors);
      }

      const { status } = parsed.data;

      // Verificar que la cotización existe
      const doc = await docRef.get();
      if (!doc.exists) {
        logger.warn('Cotización no encontrada para cambiar estado', { quoteId: id });
        requestLogger.end(404);
        return fail(res, 'Cotización no encontrada', 404);
      }

      const currentStatus = doc.data()?.status;
      
      // Validar transiciones de estado permitidas
      const validTransitions: Record<string, string[]> = {
        'enviada': ['aceptada', 'rechazada'],
        'pendiente': ['rechazada'],
        'en_proceso': ['rechazada']
      };

      if (!validTransitions[currentStatus]?.includes(status)) {
        logger.warn('Transición de estado no permitida', { quoteId: id, from: currentStatus, to: status });
        requestLogger.end(400);
        return fail(res, `No se puede cambiar de ${currentStatus} a ${status}`, 400);
      }

      const timestampUpdates: any = {
        status,
        updatedAt: nowTimestamp()
      };

      if (status === 'aprobado') {
        timestampUpdates.approvedAt = nowTimestamp();
      }
      if (status === 'rechazado') {
        timestampUpdates.rejectedAt = nowTimestamp();
      }
      if (status === 'convertida') {
        timestampUpdates.convertedAt = nowTimestamp();
      }

      const dbStart = Date.now();
      await docRef.update(timestampUpdates);
      const dbDuration = Date.now() - dbStart;
      
      logger.database('update', 'quotes', true, dbDuration);
      logger.event('quote.status_changed', { quoteId: id, status });
      logger.info('Estado de cotización cambiado exitosamente', { quoteId: id, status });

      // TODO: enviar notificación al vendedor

      const updatedDoc = await docRef.get();
      requestLogger.end(200);
      return ok(res, { id: updatedDoc.id, ...updatedDoc.data() });
    }

    logger.warn('Método no permitido', { method: req.method });
    requestLogger.end(405);
    return fail(res, 'Método no permitido', 405);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: `/api/quotes/${id}`,
      method: req.method
    });
  }
}
