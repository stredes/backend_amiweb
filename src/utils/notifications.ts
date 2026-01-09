import { collectionRef, nowTimestamp } from '../lib/firestore';
import { CreateNotificationData } from '../models/notification';
import { logger } from './logger';

/**
 * Crea una notificación en Firestore
 */
export async function createNotification(data: CreateNotificationData): Promise<string> {
  try {
    const notification = {
      userId: data.userId,
      userRole: data.userRole,
      type: data.type,
      title: data.title,
      message: data.message,
      relatedEntityType: data.relatedEntityType,
      relatedEntityId: data.relatedEntityId,
      relatedEntityNumber: data.relatedEntityNumber,
      read: false,
      priority: data.priority || 'normal',
      actionUrl: data.actionUrl,
      data: data.data || {},
      createdAt: nowTimestamp(),
      expiresAt: data.expiresAt
    };

    const docRef = await collectionRef('notifications').add(notification);
    
    logger.info('Notificación creada', {
      notificationId: docRef.id,
      userId: data.userId,
      type: data.type
    });

    return docRef.id;
  } catch (error) {
    logger.error('Error al crear notificación', { error, data });
    throw error;
  }
}

/**
 * Crea notificaciones para múltiples usuarios
 */
export async function createMultipleNotifications(
  userIds: string[],
  notificationData: Omit<CreateNotificationData, 'userId'>
): Promise<string[]> {
  const notificationIds: string[] = [];

  for (const userId of userIds) {
    try {
      const id = await createNotification({
        ...notificationData,
        userId
      });
      notificationIds.push(id);
    } catch (error) {
      logger.error('Error al crear notificación múltiple', { error, userId });
    }
  }

  return notificationIds;
}

/**
 * Marca una notificación como leída
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  try {
    await collectionRef('notifications').doc(notificationId).update({
      read: true,
      readAt: nowTimestamp()
    });

    logger.info('Notificación marcada como leída', { notificationId });
  } catch (error) {
    logger.error('Error al marcar notificación como leída', { error, notificationId });
    throw error;
  }
}

/**
 * Marca múltiples notificaciones como leídas
 */
export async function markMultipleNotificationsAsRead(notificationIds: string[]): Promise<void> {
  const promises = notificationIds.map(id => markNotificationAsRead(id));
  await Promise.all(promises);
}

/**
 * Elimina notificaciones antiguas (más de X días)
 */
export async function cleanupOldNotifications(daysOld: number = 30): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const snapshot = await collectionRef('notifications')
      .where('createdAt', '<', cutoffDate)
      .where('read', '==', true)
      .get();

    const batch = collectionRef('notifications').firestore.batch();
    snapshot.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    logger.info('Notificaciones antiguas eliminadas', { count: snapshot.size, daysOld });
    return snapshot.size;
  } catch (error) {
    logger.error('Error al limpiar notificaciones antiguas', { error, daysOld });
    throw error;
  }
}
