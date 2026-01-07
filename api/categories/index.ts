import { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef, nowTimestamp } from '../../src/lib/firestore';
import { ok, fail } from '../../src/utils/responses';
import { categorySchema } from '../../src/validation/categorySchema';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const snapshot = await collectionRef('categories')
        .where('isActive', '==', true)
        .get();

      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return ok(res, items);
    }

    if (req.method === 'POST') {
      const parsed = categorySchema.safeParse(req.body);
      if (!parsed.success) {
        return fail(res, 'Invalid category payload', 400);
      }

      const data = parsed.data;
      const docRef = collectionRef('categories').doc();
      const payload = {
        ...data,
        isActive: data.isActive ?? true,
        createdAt: nowTimestamp(),
        updatedAt: nowTimestamp()
      };

      await docRef.set(payload);
      return ok(res, { id: docRef.id, ...payload }, 201);
    }

    return fail(res, 'Method not allowed', 405);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('categories index error', error);
    return fail(res, 'Unexpected error', 500);
  }
}
