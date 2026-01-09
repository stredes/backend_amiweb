import { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef, nowTimestamp } from '../../src/lib/firestore';
import { ok, fail } from '../../src/utils/responses';
import { requireAuth } from '../../src/middleware/auth';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import { logger } from '../../src/utils/logger';
import { handleError } from '../../src/utils/errorHandler';
import { z } from 'zod';

/**
 * GET /api/notifications
 * Lista las notificaciones del usuario autenticado
 * 
 * Query params:
 * - unreadOnly: boolean (default: false) - Solo notificaciones no leídas
 * - limit: number (default: 50) - Cantidad máxima de notificaciones
 * 
 * PATCH /api/notifications
 * Marca notificaciones como leídas
 * Body: { notificationIds: string[] } o { markAllAsRead: true }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);

  try {
    // Verificar autenticación
    const isAuthenticated = await requireAuth(req, res);
    if (!isAuthenticated) {
      requestLogger.end(401);
      return;
    }

    const user = (req as any).user;
    const userId = user.uid;

    // GET: Listar notificaciones
    if (req.method === 'GET') {
      const unreadOnly = req.query.unreadOnly === 'true';
      const limit = parseInt(req.query.limit as string) || 50;

      logger.debug('Listando notificaciones', { userId, unreadOnly, limit });

      let query = collectionRef('notifications')
        .where('userId', '==', userId);

      if (unreadOnly) {
        query = query.where('read', '==', false);
      }

      query = query.orderBy('createdAt', 'desc').limit(limit);

      const dbStart = Date.now();
      const snapshot = await query.get();
      const dbDuration = Date.now() - dbStart;

      logger.database('read', 'notifications', true, dbDuration);

      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Contar no leídas
      const unreadCount = notifications.filter((n: any) => !n.read).length;

      logger.info('Notificaciones listadas', {
        userId,
        total: notifications.length,
        unread: unreadCount
      });

      requestLogger.end(200);
      return ok(res, {
        notifications,
        total: notifications.length,
        unreadCount
      });
    }

    // PATCH: Marcar como leídas
    if (req.method === 'PATCH') {
      const schema = z.object({
        notificationIds: z.array(z.string()).optional(),
        markAllAsRead: z.boolean().optional()
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        logger.warn('Validación fallida', { errors: parsed.error.errors });
        requestLogger.end(400);
        return fail(res, 'Datos inválidos', 400, parsed.error.errors);
      }

      const { notificationIds, markAllAsRead } = parsed.data;

      if (markAllAsRead) {
        // Marcar todas como leídas
        logger.debug('Marcando todas las notificaciones como leídas', { userId });

        const snapshot = await collectionRef('notifications')
          .where('userId', '==', userId)
          .where('read', '==', false)
          .get();

        const batch = collectionRef('notifications').firestore.batch();
        snapshot.docs.forEach(doc => {
          batch.update(doc.ref, {
            read: true,
            readAt: nowTimestamp()
          });
        });

        const dbStart = Date.now();
        await batch.commit();
        const dbDuration = Date.now() - dbStart;

        logger.database('update', 'notifications', true, dbDuration);
        logger.info('Todas las notificaciones marcadas como leídas', {
          userId,
          count: snapshot.size
        });

        requestLogger.end(200);
        return ok(res, {
          message: 'Notificaciones marcadas como leídas',
          count: snapshot.size
        });
      } else if (notificationIds && notificationIds.length > 0) {
        // Marcar específicas como leídas
        logger.debug('Marcando notificaciones como leídas', {
          userId,
          count: notificationIds.length
        });

        const batch = collectionRef('notifications').firestore.batch();
        
        for (const id of notificationIds) {
          const docRef = collectionRef('notifications').doc(id);
          const doc = await docRef.get();
          
          // Verificar que la notificación pertenece al usuario
          if (doc.exists && doc.data()?.userId === userId) {
            batch.update(docRef, {
              read: true,
              readAt: nowTimestamp()
            });
          }
        }

        const dbStart = Date.now();
        await batch.commit();
        const dbDuration = Date.now() - dbStart;

        logger.database('update', 'notifications', true, dbDuration);
        logger.info('Notificaciones marcadas como leídas', {
          userId,
          count: notificationIds.length
        });

        requestLogger.end(200);
        return ok(res, {
          message: 'Notificaciones marcadas como leídas',
          count: notificationIds.length
        });
      } else {
        logger.warn('No se especificaron notificaciones para marcar', { userId });
        requestLogger.end(400);
        return fail(res, 'Debe especificar notificationIds o markAllAsRead', 400);
      }
    }

    // DELETE: Eliminar notificaciones leídas
    if (req.method === 'DELETE') {
      logger.debug('Eliminando notificaciones leídas', { userId });

      const snapshot = await collectionRef('notifications')
        .where('userId', '==', userId)
        .where('read', '==', true)
        .get();

      const batch = collectionRef('notifications').firestore.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      const dbStart = Date.now();
      await batch.commit();
      const dbDuration = Date.now() - dbStart;

      logger.database('delete', 'notifications', true, dbDuration);
      logger.info('Notificaciones leídas eliminadas', {
        userId,
        count: snapshot.size
      });

      requestLogger.end(200);
      return ok(res, {
        message: 'Notificaciones leídas eliminadas',
        count: snapshot.size
      });
    }

    logger.warn('Método no permitido', { method: req.method });
    requestLogger.end(405);
    return fail(res, 'Método no permitido', 405);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/notifications',
      method: req.method
    });
  }
}
