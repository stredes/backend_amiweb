import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../../src/middleware/auth';
import { enableCors, handleCorsPreFlight } from '../../src/middleware/cors';
import { collectionRef, nowTimestamp } from '../../src/lib/firestore';
import { ok, fail } from '../../src/utils/responses';
import { handleError } from '../../src/utils/errorHandler';
import { inventoryUploadSchema } from '../../src/validation/inventorySchema';

/**
 * POST /api/inventory/upload
 * Subir productos desde un archivo procesado en el frontend
 * 
 * Requiere autenticación: Sí (admin)
 * 
 * Body (JSON):
 * {
 *   "products": [
 *     {
 *       "name": "Producto 1",
 *       "slug": "producto-1",
 *       "categoryId": "cat123",
 *       "brand": "Marca",
 *       "shortDescription": "Descripción corta",
 *       "longDescription": "Descripción larga",
 *       "specs": { "key": "value" },
 *       "requiresInstallation": false,
 *       "isActive": true,
 *       "stock": 10,
 *       "price": 1000
 *     }
 *   ],
 *   "overwriteExisting": false
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "totalProcessed": 100,
 *     "successful": 95,
 *     "failed": 5,
 *     "skipped": 0,
 *     "errors": [...],
 *     "createdIds": [...]
 *   }
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  enableCors(req, res);

  if (handleCorsPreFlight(req, res)) {
    return;
  }

  try {
    // Log de conexión desde el frontend
    const origin = req.headers.origin || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    console.log(`[INVENTORY UPLOAD] Request from frontend:`, {
      origin,
      userAgent,
      timestamp: new Date().toISOString(),
      method: req.method
    });

    if (req.method !== 'POST') {
      return fail(res, 'Method not allowed', 405);
    }

    // Autenticación requerida
    const isAuthenticated = await requireAuth(req, res);
    if (!isAuthenticated) {
      return; // requireAuth ya envió la respuesta
    }

    // Validar datos
    const parsed = inventoryUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, `Invalid payload: ${parsed.error.message}`, 400);
    }

    const { products, overwriteExisting } = parsed.data;

    // Log de parámetros recibidos
    console.log(`[INVENTORY UPLOAD] Processing batch:`, {
      origin: req.headers.origin || 'unknown',
      productsCount: products.length,
      overwriteExisting,
      timestamp: new Date().toISOString()
    });

    if (products.length === 0) {
      return fail(res, 'No products to process', 400);
    }

    if (products.length > 500) {
      return fail(res, 'Maximum 500 products per batch', 400);
    }

    const results = {
      totalProcessed: products.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [] as Array<{ index: number; name: string; error: string }>,
      createdIds: [] as string[]
    };

    // Procesar cada producto
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      
      try {
        // Verificar si ya existe por slug
        const existingQuery = await collectionRef('products')
          .where('slug', '==', product.slug)
          .limit(1)
          .get();

        if (!existingQuery.empty && !overwriteExisting) {
          results.skipped++;
          results.errors.push({
            index: i,
            name: product.name,
            error: 'Product with this slug already exists'
          });
          continue;
        }

        // Crear o actualizar producto
        const productData = {
          ...product,
          createdAt: overwriteExisting && !existingQuery.empty 
            ? existingQuery.docs[0].data().createdAt 
            : nowTimestamp(),
          updatedAt: nowTimestamp()
        };

        if (!existingQuery.empty && overwriteExisting) {
          // Actualizar existente
          const docId = existingQuery.docs[0].id;
          await collectionRef('products').doc(docId).update(productData);
          results.createdIds.push(docId);
        } else {
          // Crear nuevo
          const docRef = collectionRef('products').doc();
          await docRef.set(productData);
          results.createdIds.push(docRef.id);
        }

        results.successful++;

      } catch (error) {
        results.failed++;
        results.errors.push({
          index: i,
          name: product.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Log de resultados finales
    console.log(`[INVENTORY UPLOAD] Batch completed:`, {
      origin: req.headers.origin || 'unknown',
      totalProcessed: results.totalProcessed,
      successful: results.successful,
      failed: results.failed,
      skipped: results.skipped,
      timestamp: new Date().toISOString()
    });

    return ok(res, results, 201);

  } catch (error) {
    return handleError(error, res, {
      endpoint: '/api/inventory/upload',
      method: req.method || 'POST'
    });
  }
}
