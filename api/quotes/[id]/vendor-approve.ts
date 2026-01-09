import { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef, nowTimestamp } from '../../../src/lib/firestore';
import { ok, fail } from '../../../src/utils/responses';
import { requireAuth, requireRole } from '../../../src/middleware/auth';
import { vendorApprovalSchema } from '../../../src/validation/quoteSchema';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import { logger } from '../../../src/utils/logger';
import { handleError } from '../../../src/utils/errorHandler';
import { createNotification } from '../../../src/utils/notifications';
import { getFirebaseApp } from '../../../src/lib/firebase';

/**
 * POST /api/quotes/[id]/vendor-approve
 * Permite al vendedor aprobar o rechazar una cotización
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
    // Verificar autenticación y rol
    const isAuthenticated = await requireAuth(req, res);
    if (!isAuthenticated) {
      requestLogger.end(401);
      return;
    }

    const isAuthorized = await requireRole(req, res, ['vendedor', 'admin', 'root']);
    if (!isAuthorized) {
      requestLogger.end(403);
      return;
    }

    const user = (req as any).user;
    const userId = user.uid;
    const userName = user.email || 'Vendedor';

    // Validar body
    const parsed = vendorApprovalSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn('Validación de aprobación fallida', { errors: parsed.error.errors });
      requestLogger.end(400);
      return fail(res, 'Datos de aprobación inválidos', 400, parsed.error.errors);
    }

    const { approved, notes, rejectionReason } = parsed.data;

    logger.debug('Procesando aprobación de vendedor', { quoteId: id, approved, userId });

    const docRef = collectionRef('quotes').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      logger.warn('Cotización no encontrada', { quoteId: id });
      requestLogger.end(404);
      return fail(res, 'Cotización no encontrada', 404);
    }

    const quote = doc.data();

    // Verificar que el vendedor es el asignado (excepto admin/root)
    const userRole = user.role;
    if (userRole === 'vendedor' && quote?.assignedSalesRep !== userId) {
      logger.warn('Vendedor no asignado a esta cotización', { quoteId: id, userId });
      requestLogger.end(403);
      return fail(res, 'No tienes permiso para aprobar esta cotización', 403);
    }

    // Verificar que está en estado correcto
    if (quote?.status !== 'pendiente' && quote?.status !== 'en_revision_vendedor') {
      logger.warn('Estado inválido para aprobación de vendedor', {
        quoteId: id,
        currentStatus: quote?.status
      });
      requestLogger.end(400);
      return fail(res, 'La cotización no está en un estado válido para aprobación', 400);
    }

    // Actualizar cotización
    const updates: any = {
      updatedAt: nowTimestamp(),
      updatedBy: userId
    };

    if (approved) {
      // Aprobada por vendedor -> pasa a revisión de admin
      updates.status = 'aprobado_vendedor';
      updates.vendorApprovedAt = nowTimestamp();
      updates.vendorApprovedBy = userId;
      if (notes) updates.vendorNotes = notes;

      logger.info('Cotización aprobada por vendedor', { quoteId: id, userId });
    } else {
      // Rechazada por vendedor
      updates.status = 'rechazado_vendedor';
      updates.vendorRejectedAt = nowTimestamp();
      updates.vendorRejectedBy = userId;
      if (rejectionReason) updates.rejectionReason = rejectionReason;
      if (notes) updates.vendorNotes = notes;

      logger.info('Cotización rechazada por vendedor', { quoteId: id, userId });
    }

    const dbStart = Date.now();
    await docRef.update(updates);
    const dbDuration = Date.now() - dbStart;

    logger.database('update', 'quotes', true, dbDuration);
    logger.event('quote.vendor_approval', { quoteId: id, approved, userId });

    // Crear notificaciones
    if (approved) {
      // Notificar a todos los admins
      const app = getFirebaseApp();
      const adminsSnapshot = await app.auth().listUsers();
      const adminUsers = adminsSnapshot.users.filter((u: any) =>
        u.customClaims?.role === 'admin' || u.customClaims?.role === 'root'
      );

      for (const adminUser of adminUsers) {
        await createNotification({
          userId: adminUser.uid,
          userRole: 'admin',
          type: 'quote_vendor_approved',
          title: 'Cotización aprobada por vendedor',
          message: `La cotización ${quote?.quoteNumber} ha sido aprobada por ${userName} y requiere tu revisión`,
          relatedEntityType: 'quote',
          relatedEntityId: id,
          relatedEntityNumber: quote?.quoteNumber,
          priority: 'normal',
          actionUrl: `/admin/quotes/${id}`
        });
      }

      // Notificar al cliente
      if (quote?.userId) {
        await createNotification({
          userId: quote.userId,
          type: 'quote_vendor_approved',
          title: 'Tu cotización está en revisión',
          message: `Tu cotización ${quote.quoteNumber} ha sido aprobada por el vendedor y está siendo revisada`,
          relatedEntityType: 'quote',
          relatedEntityId: id,
          relatedEntityNumber: quote.quoteNumber,
          priority: 'normal',
          actionUrl: `/quotes/${id}`
        });
      }
    } else {
      // Notificar al cliente del rechazo
      if (quote?.userId) {
        await createNotification({
          userId: quote.userId,
          type: 'quote_vendor_rejected',
          title: 'Cotización rechazada',
          message: `Tu cotización ${quote.quoteNumber} ha sido rechazada. ${rejectionReason || ''}`,
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
      endpoint: `/api/quotes/${id}/vendor-approve`,
      method: req.method
    });
  }
}
