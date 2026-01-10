import { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef, nowTimestamp } from '../../../src/lib/firestore';
import { ok, fail } from '../../../src/utils/responses';
import { requireAuth, requireRole } from '../../../src/middleware/auth';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import { logger } from '../../../src/utils/logger';
import { handleError } from '../../../src/utils/errorHandler';
import { assignOrderToWarehouse } from '../../../src/utils/warehouseAssignment';
import { createNotification } from '../../../src/utils/notifications';
import { z } from 'zod';

const reassignSchema = z.object({
  assignTo: z.string().optional(), // Si se especifica, asignar a este usuario
  autoAssign: z.boolean().optional() // Si es true, usar asignación automática
});

/**
 * POST /api/warehouse/reassign/[orderId]
 * Reasigna un pedido a otro usuario de bodega
 * Puede ser asignación manual (especificando usuario) o automática
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);
  const { orderId } = req.query;

  if (!orderId || Array.isArray(orderId)) {
    requestLogger.end(400);
    return fail(res, 'ID de orden inválido', 400);
  }

  if (req.method !== 'POST') {
    requestLogger.end(405);
    return fail(res, 'Método no permitido', 405);
  }

  try {
    // Verificar autenticación y permisos (admin o bodega)
    const isAuthenticated = await requireAuth(req, res);
    if (!isAuthenticated) return;

    const isAuthorized = await requireRole(req, res, ['admin', 'root', 'bodega']);
    if (!isAuthorized) return;

    const user = (req as any).user;
    const userId = user.uid;

    // Validar body
    const parsed = reassignSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn('Validación de reasignación fallida', { errors: parsed.error.errors });
      requestLogger.end(400);
      return fail(res, 'Datos de reasignación inválidos', 400, parsed.error.errors);
    }

    const { assignTo, autoAssign } = parsed.data;

    if (!assignTo && !autoAssign) {
      requestLogger.end(400);
      return fail(res, 'Debe especificar assignTo o autoAssign=true', 400);
    }

    logger.debug('Reasignando pedido', { orderId, assignTo, autoAssign, userId });

    // Buscar la preparación existente
    const preparationsSnapshot = await collectionRef('orderPreparations')
      .where('orderId', '==', orderId)
      .limit(1)
      .get();

    if (preparationsSnapshot.empty) {
      // No existe preparación, verificar que la orden existe
      const orderDoc = await collectionRef('orders').doc(orderId).get();
      if (!orderDoc.exists) {
        logger.warn('Orden no encontrada', { orderId });
        requestLogger.end(404);
        return fail(res, 'Orden no encontrada', 404);
      }

      requestLogger.end(400);
      return fail(res, 'No existe una preparación para esta orden', 400);
    }

    const preparationDoc = preparationsSnapshot.docs[0];
    const preparation = preparationDoc.data();
    const previousAssignee = preparation.assignedTo;

    // No permitir reasignar si ya está preparado o despachado
    if (preparation.status === 'preparado' || preparation.status === 'despachado') {
      logger.warn('No se puede reasignar pedido ya preparado/despachado', {
        orderId,
        status: preparation.status
      });
      requestLogger.end(400);
      return fail(res, 'No se puede reasignar un pedido ya preparado o despachado', 400);
    }

    let newAssignee: string;
    let newAssigneeName: string;
    let assignmentType: 'auto' | 'manual';

    if (autoAssign) {
      // Asignación automática
      const assignment = await assignOrderToWarehouse(preparation.totalItems);
      newAssignee = assignment.assignedTo;
      newAssigneeName = assignment.assignedToName;
      assignmentType = 'auto';

      logger.info('Reasignación automática', {
        orderId,
        from: previousAssignee,
        to: newAssignee,
        reason: assignment.reason
      });
    } else {
      // Asignación manual
      newAssignee = assignTo!;
      
      // Obtener nombre del nuevo asignado
      const { getFirebaseApp } = await import('../../../src/lib/firebase');
      const app = getFirebaseApp();
      try {
        const userRecord = await app.auth().getUser(newAssignee);
        newAssigneeName = userRecord.displayName || userRecord.email || 'Usuario de Bodega';
        
        // Verificar que sea usuario de bodega
        if (userRecord.customClaims?.role !== 'bodega') {
          requestLogger.end(400);
          return fail(res, 'El usuario especificado no es un usuario de bodega', 400);
        }
      } catch (error) {
        logger.warn('Usuario no encontrado para asignación manual', { assignTo });
        requestLogger.end(404);
        return fail(res, 'Usuario no encontrado', 404);
      }

      assignmentType = 'manual';

      logger.info('Reasignación manual', {
        orderId,
        from: previousAssignee,
        to: newAssignee,
        by: userId
      });
    }

    // Actualizar preparación
    const updates: any = {
      assignedTo: newAssignee,
      assignedToName: newAssigneeName,
      assignedAt: nowTimestamp(),
      assignedBy: assignmentType,
      updatedAt: nowTimestamp(),
      reassignedFrom: previousAssignee,
      reassignedBy: userId,
      reassignedAt: nowTimestamp()
    };

    // Si estaba en_preparacion, volver a asignado
    if (preparation.status === 'en_preparacion') {
      updates.status = 'asignado';
    }

    await preparationDoc.ref.update(updates);

    logger.database('update', 'orderPreparations', true);
    logger.event('order.reassigned', {
      orderId,
      from: previousAssignee,
      to: newAssignee,
      type: assignmentType
    });

    // Notificar al nuevo asignado
    await createNotification({
      userId: newAssignee,
      userRole: 'bodega',
      type: 'order_new',
      title: 'Pedido reasignado a ti',
      message: `El pedido ${preparation.orderNumber} te ha sido reasignado (${preparation.totalItems} items)`,
      relatedEntityType: 'order',
      relatedEntityId: orderId,
      relatedEntityNumber: preparation.orderNumber,
      priority: 'high',
      actionUrl: `/warehouse/orders/${orderId}`
    });

    // Notificar al anterior asignado (si existía)
    if (previousAssignee && previousAssignee !== newAssignee) {
      await createNotification({
        userId: previousAssignee,
        userRole: 'bodega',
        type: 'order_cancelled', // Reutilizamos este tipo
        title: 'Pedido reasignado',
        message: `El pedido ${preparation.orderNumber} ha sido reasignado a otro usuario`,
        relatedEntityType: 'order',
        relatedEntityId: orderId,
        relatedEntityNumber: preparation.orderNumber,
        priority: 'normal'
      });
    }

    // Obtener datos actualizados
    const updatedDoc = await preparationDoc.ref.get();

    requestLogger.end(200);
    return ok(res, {
      preparation: { id: updatedDoc.id, ...updatedDoc.data() },
      message: `Pedido reasignado exitosamente a ${newAssigneeName}`,
      previousAssignee,
      newAssignee,
      assignmentType
    });
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: `/api/warehouse/reassign/${orderId}`,
      method: req.method
    });
  }
}
