import { collectionRef } from '../lib/firestore';

export async function listNotifications(limit = 20, unreadOnly = false) {
  let query: any = collectionRef('notifications');
  if (unreadOnly) {
    query = query.where('read', '==', false);
  }
  query = query.orderBy('createdAt', 'desc').limit(limit);
  const snapshot = await query.get();
  return snapshot.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }));
}
