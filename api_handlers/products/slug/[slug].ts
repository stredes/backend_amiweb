import { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef } from '../../../src/lib/firestore';
import { ok, fail } from '../../../src/utils/responses';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { slug } = req.query;
  if (!slug || Array.isArray(slug)) {
    return fail(res, 'Invalid product slug', 400);
  }

  try {
    const snapshot = await collectionRef('products')
      .where('slug', '==', slug)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) return fail(res, 'Product not found', 404);
    const doc = snapshot.docs[0];
    return ok(res, { id: doc.id, ...doc.data() });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('products slug error', error);
    return fail(res, 'Unexpected error', 500);
  }
}
