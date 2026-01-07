import { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef, nowTimestamp } from '../../src/lib/firestore';
import { ok, fail } from '../../src/utils/responses';
import { parsePagination } from '../../src/utils/pagination';
import { productSchema } from '../../src/validation/productSchema';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      const { categoryId, search } = req.query;
      const { page, pageSize, offset } = parsePagination(req.query as Record<string, string>);

      let query = collectionRef('products').where('isActive', '==', true);

      if (categoryId && !Array.isArray(categoryId)) {
        query = query.where('categoryId', '==', categoryId);
      }

      // TODO: Para búsquedas eficientes, usar un índice de búsqueda o un campo "searchKeywords".
      const snapshot = await query.orderBy('name').offset(offset).limit(pageSize).get();
      let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

      if (search && !Array.isArray(search)) {
        const term = search.toLowerCase();
        items = items.filter(item =>
          String(item.name || '').toLowerCase().includes(term) ||
          String(item.brand || '').toLowerCase().includes(term)
        );
      }

      return ok(res, {
        items,
        total: items.length,
        page,
        pageSize
      });
    }

    if (req.method === 'POST') {
      const parsed = productSchema.safeParse(req.body);
      if (!parsed.success) {
        return fail(res, 'Invalid product payload', 400);
      }

      const data = parsed.data;
      const docRef = collectionRef('products').doc();
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
    console.error('products index error', error);
    return fail(res, 'Unexpected error', 500);
  }
}
