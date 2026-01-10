import { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef, nowTimestamp } from '../../src/lib/firestore';
import { ok, fail } from '../../src/utils/responses';
import { parsePagination } from '../../src/utils/pagination';
import { productSchema } from '../../src/validation/productSchema';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import { logger } from '../../src/utils/logger';
import { handleError } from '../../src/utils/errorHandler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);
  
  try {
    if (req.method === 'GET') {
      const { categoryId, search } = req.query;
      const { page, pageSize, offset } = parsePagination(req.query as Record<string, string>);

      logger.debug('Consultando productos', { categoryId, search, page, pageSize });

      let query = collectionRef('products').where('isActive', '==', true);

      if (categoryId && !Array.isArray(categoryId)) {
        query = query.where('categoryId', '==', categoryId);
      }

      // TODO: Para búsquedas eficientes, usar un índice de búsqueda o un campo "searchKeywords".
      const dbStart = Date.now();
      const snapshot = await query.orderBy('name').offset(offset).limit(pageSize).get();
      const dbDuration = Date.now() - dbStart;
      
      logger.database('query', 'products', true, dbDuration);
      
      let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

      if (search && !Array.isArray(search)) {
        const term = search.toLowerCase();
        items = items.filter(item =>
          String(item.name || '').toLowerCase().includes(term) ||
          String(item.brand || '').toLowerCase().includes(term)
        );
        logger.debug('Filtrado de búsqueda aplicado', { term, resultCount: items.length });
      }

      logger.info('Productos consultados exitosamente', { count: items.length, page });
      requestLogger.end(200);
      return ok(res, {
        items,
        total: items.length,
        page,
        pageSize
      });
    }

    if (req.method === 'POST') {
      logger.debug('Creando nuevo producto', { body: req.body });
      
      const parsed = productSchema.safeParse(req.body);
      if (!parsed.success) {
        logger.warn('Validación de producto fallida', { errors: parsed.error.errors });
        requestLogger.end(400);
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

      const dbStart = Date.now();
      await docRef.set(payload);
      const dbDuration = Date.now() - dbStart;
      
      logger.database('create', 'products', true, dbDuration);
      logger.event('product.created', { productId: docRef.id, name: data.name });
      logger.info('Producto creado exitosamente', { productId: docRef.id });
      
      requestLogger.end(201);
      return ok(res, { id: docRef.id, ...payload }, 201);
    }

    logger.warn('Método no permitido', { method: req.method });
    requestLogger.end(405);
    return fail(res, 'Method not allowed', 405);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/products',
      method: req.method
    });
  }
}
