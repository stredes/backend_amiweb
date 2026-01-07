import { VercelRequest, VercelResponse } from '@vercel/node';
import { docRef, nowTimestamp } from '../../src/lib/firestore';
import { ok, fail } from '../../src/utils/responses';
import { productUpdateSchema } from '../../src/validation/productSchema';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return fail(res, 'Invalid product id', 400);
  }

  try {
    const ref = docRef('products', id);

    if (req.method === 'GET') {
      const doc = await ref.get();
      if (!doc.exists) return fail(res, 'Product not found', 404);
      return ok(res, { id: doc.id, ...doc.data() });
    }

    if (req.method === 'PUT') {
      const parsed = productUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return fail(res, 'Invalid product payload', 400);
      }

      await ref.update({
        ...parsed.data,
        updatedAt: nowTimestamp()
      });

      const updated = await ref.get();
      return ok(res, { id: updated.id, ...updated.data() });
    }

    if (req.method === 'DELETE') {
      // Soft delete: mantenemos el documento pero lo desactivamos.
      await ref.update({ isActive: false, updatedAt: nowTimestamp() });
      return ok(res, { id, isActive: false });
    }

    return fail(res, 'Method not allowed', 405);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('products id error', error);
    return fail(res, 'Unexpected error', 500);
  }
}
