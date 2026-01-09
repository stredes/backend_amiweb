import { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef, nowTimestamp } from '../../../src/lib/firestore';
import { ok, fail } from '../../../src/utils/responses';
import { requireAuth, requireRole } from '../../../src/middleware/auth';
import { adminApprovalSchema } from '../../../src/validation/quoteSchema';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import { logger } from '../../../src/utils/logger';
import { handleError } from '../../../src/utils/errorHandler';
import { createNotification } from '../../../src/utils/notifications';

/**
 * POST /api/quotes/[id]/admin-approve
 * Permite al admin aprobar o rechazar una cotización
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);
  const { id } = req.query;

  if (!id || Array.isArray(id)) {
    requestLogger.end(400);
    return fail(res, 'ID de cotización inválido', 400);
  }

  if (req.method !== 'POST') {
    requestLogger.end(405);
    return fail(res, 'Método no permitido', 405);
  }

  try {
    // Verificar autenticación y rol admin
    const isAuthenticated = await requireAuth(req, res);
    if (!isAuthenticated) {
      requestLogger.end(401);
      return;
    }

    const isAuthorized = await requireRole(req, res, ['admin', 'root']);
    if (!isAuthorized) {
      requestLogger.end(403);
      return;
    }

    const user = (req as any).user;
    const userId = user.uid;
    const userName = user.email || 'Administrador';

    // Validar body
    const parsed = adminApprovalSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn('Validación de aprobación fallida', { errors: parsed.error.errors });
      requestLogger.end(400);
      return fail(res, 'Datos de aprobación inválidos', 400, parsed.error.errors);
    }

    const { approved, notes, rejectionReason } = parsed.data;

    logger.debug('Procesando aprobación de admin', { quoteId: id, approved, userId });

    const docRef = collectionRef('quotes').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      logger.warn('Cotización no encontrada', { quoteId: id });
      requestLogger.end(404);
      return fail(res, 'Cotización no encontrada', 404);
    }

    const quote = doc.data();

    // Verificar que está en estado correcto
    if (quote?.status !== 'aprobado_vendedor' && quote?.status !== 'en_revision_admin') {
      logger.warn('Estado inválido para aprobación de admin', {
        quoteId: id,
        currentStatus: quote?.status
      });
      requestLogger.end(400);
      return fail(res, 'La cotización no está en un estado válido para aprobación de admin', 400);
    }

    // Actualizar cotización
    const updates: any = {
      updatedAt: nowTimestamp(),
      updatedBy: userId
    };

    if (approved) {
      // Aprobada por admin -> puede convertirse en orden
      updates.status = 'aprobado';
      updates.adminApprovedAt = nowTimestamp();
      updates.adminApprovedBy = userId;
      if (notes) updates.adminNotes = notes;

      logger.info('Cotización aprobada por admin', { quoteId: id, userId });
    } else {
      // Rechazada por admin
      updates.status = 'rechazado';
      updates.adminRejectedAt = nowTimestamp();
      updates.adminRejectedBy = userId;
      if (rejectionReason) updates.rejectionReason = rejectionReason;
      if (notes) updates.adminNotes = notes;

      logger.info('Cotización rechazada por admin', { quoteId: id, userId });
    }

    const dbStart = Date.now();
    await docRef.update(updates);
    const dbDuration = Date.now() - dbStart;

    logger.database('update', 'quotes', true, dbDuration);
    logger.event('quote.admin_approval', { quoteId: id, approved, userId });

    // Crear notificaciones
    if (approved) {
      // Notificar al vendedor asignado
      if (quote?.assignedSalesRep) {
        await createNotification({
          userId: quote.assignedSalesRep,
          userRole: 'vendedor',
          type: 'quote_admin_approved',
          title: 'Cotización aprobada',
          message: `La cotización ${quote.quoteNumber} ha sido aprobada y está lista para convertirse en orden`,
          relatedEntityType: 'quote',
          relatedEntityId: id,
          relatedEntityNumber: quote.quoteNumber,
          priority: 'high',
          actionUrl: `/quotes/${id}`
        });
      }

      // Notificar al cliente
      if (quote?.userId) {
        await createNotification({
          userId: quote.userId,
          type: 'quote_admin_approved',
          title: 'Tu cotización ha sido aprobada',
          message: `Tu cotización ${quote.quoteNumber} ha sido aprobada. Puedes proceder con la orden`,
          relatedEntityType: 'quote',
          relatedEntityId: id,
          relatedEntityNumber: quote.quoteNumber,
          priority: 'high',
          actionUrl: `/quotes/${id}`
        });
      }

      // Notificar a bodega que habrá un nuevo pedido pronto
      // (opcional, se notificará cuando se convierta a orden)
    } else {
      // Notificar al vendedor del rechazo
      if (quote?.assignedSalesRep) {
        await createNotification({
          userId: quote.assignedSalesRep,
          userRole: 'vendedor',
          type: 'quote_admin_rejected',
          title: 'Cotización rechazada por admin',
          message: `La cotización ${quote.quoteNumber} fue rechazada. ${rejectionReason || ''}`,
          relatedEntityType: 'quote',
          relatedEntityId: id,
          relatedEntityNumber: quote.quoteNumber,
          priority: 'high',
          actionUrl: `/quotes/${id}`
        });
      }

      // Notificar al cliente
      if (quote?.userId) {
        await createNotification({
          userId: quote.userId,
          type: 'quote_admin_rejected',
          title: 'Cotización no aprobada',
          message: `Tu cotización ${quote.quoteNumber} no pudo ser aprobada. ${rejectionReason || 'Contacta con tu vendedor para más información'}`,
          relatedEntityType: 'quote',
          relatedEntityId: id,
          relatedEntityNumber: quote.quoteNumber,
          priority: 'high',
          actionUrl: `/quotes/${id}`
        });
      }
    }

    // Obtener datos actualizados
    const updatedDoc = await docRef.get();
    requestLogger.end(200);
    return ok(res, {
      quote: { id: updatedDoc.id, ...updatedDoc.data() },
      message: approved ? 'Cotización aprobada exitosamente' : 'Cotización rechazada'
    });
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: `/api/quotes/${id}/admin-approve`,
      method: req.method
    });
  }
}
