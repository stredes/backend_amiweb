import { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef, nowTimestamp } from '../../src/lib/firestore';
import { ok, fail } from '../../src/utils/responses';
import { parsePagination } from '../../src/utils/pagination';
import { supportRequestSchema } from '../../src/validation/supportRequestSchema';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'POST') {
      const parsed = supportRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return fail(res, 'Invalid support request payload', 400);
      }

      const data = parsed.data;
      const docRef = collectionRef('supportRequests').doc();
      const payload = {
        ...data,
        status: 'pendiente',
        createdAt: nowTimestamp(),
        updatedAt: nowTimestamp()
      };

      await docRef.set(payload);

      // TODO: enviar notificación por correo al equipo de soporte.

      return ok(res, { id: docRef.id, ...payload }, 201);
    }

    if (req.method === 'GET') {
      const { status, serviceType, email } = req.query;
      const { page, pageSize, offset } = parsePagination(req.query as Record<string, string>);

      let query = collectionRef('supportRequests').orderBy('createdAt', 'desc');

      if (status && !Array.isArray(status)) {
        query = query.where('status', '==', status);
      }
      if (serviceType && !Array.isArray(serviceType)) {
        query = query.where('serviceType', '==', serviceType);
      }
      if (email && !Array.isArray(email)) {
        query = query.where('email', '==', email);
      }

      const snapshot = await query.offset(offset).limit(pageSize).get();
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      return ok(res, { items, total: items.length, page, pageSize });
    }

    return fail(res, 'Method not allowed', 405);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('support requests error', error);
    return fail(res, 'Unexpected error', 500);
  }
}
