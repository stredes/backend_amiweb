import { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef, nowTimestamp } from '../../src/lib/firestore';
import { ok, fail } from '../../src/utils/responses';
import { parsePagination } from '../../src/utils/pagination';
import { contactMessageSchema } from '../../src/validation/contactMessageSchema';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'POST') {
      const parsed = contactMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        return fail(res, 'Invalid contact message payload', 400);
      }

      const data = parsed.data;
      const docRef = collectionRef('contactMessages').doc();
      const payload = {
        ...data,
        createdAt: nowTimestamp()
      };

      await docRef.set(payload);
      return ok(res, { id: docRef.id, ...payload }, 201);
    }

    if (req.method === 'GET') {
      const { page, pageSize, offset } = parsePagination(req.query as Record<string, string>);
      const snapshot = await collectionRef('contactMessages')
        .orderBy('createdAt', 'desc')
        .offset(offset)
        .limit(pageSize)
        .get();

      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return ok(res, { items, total: items.length, page, pageSize });
    }

    return fail(res, 'Method not allowed', 405);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('contact messages error', error);
    return fail(res, 'Unexpected error', 500);
  }
}
