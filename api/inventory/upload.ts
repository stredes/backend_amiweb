import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../../src/middleware/auth';
import { enableCors, handleCorsPreFlight } from '../../src/middleware/cors';
import { collectionRef, nowTimestamp } from '../../src/lib/firestore';
import { firestore } from '../../src/lib/firebase';
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
      return fail(res, 'Maximum 500 products per batch. Recommended: 200 for optimal performance', 400);
    }

    // Advertir si el lote es muy grande (mayor a 200)
    if (products.length > 200) {
      console.warn(`[INVENTORY UPLOAD] Large batch detected: ${products.length} products. Consider using batches of 200 for better performance`);
    }

    const results = {
      totalProcessed: products.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [] as Array<{ index: number; name: string; error: string; isTransient?: boolean; slug?: string }>,
      createdIds: [] as string[]
    };

    // Función helper para clasificar errores
    const isTransientError = (error: any): boolean => {
      const transientKeywords = [
        'DEADLINE_EXCEEDED',
        'UNAVAILABLE',
        'timeout',
        'network',
        'connection',
        'ECONNRESET',
        'ETIMEDOUT'
      ];
      const errorMsg = error?.message || error?.toString() || '';
      return transientKeywords.some(keyword => 
        errorMsg.toLowerCase().includes(keyword.toLowerCase())
      );
    };

    // OPTIMIZACIÓN: Obtener todos los productos existentes con los slugs relevantes en una sola query
    const slugs = products.map(p => p.slug);
    const existingProductsSnapshot = await collectionRef('products')
      .where('slug', 'in', slugs.slice(0, 10)) // Firestore limit: 10 items in 'in' query
      .get();

    // Si hay más de 10 slugs, hacer queries adicionales en paralelo
    const existingProductsMap = new Map<string, { id: string; createdAt: any }>();
    
    if (slugs.length <= 10) {
      existingProductsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        existingProductsMap.set(data.slug, { id: doc.id, createdAt: data.createdAt });
      });
    } else {
      // Dividir en chunks de 10 y hacer queries en paralelo
      const chunks: string[][] = [];
      for (let i = 0; i < slugs.length; i += 10) {
        chunks.push(slugs.slice(i, i + 10));
      }

      const queryPromises = chunks.map(chunk =>
        collectionRef('products')
          .where('slug', 'in', chunk)
          .get()
      );

      const results = await Promise.all(queryPromises);
      results.forEach(snapshot => {
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          existingProductsMap.set(data.slug, { id: doc.id, createdAt: data.createdAt });
        });
      });
    }

    console.log(`[INVENTORY UPLOAD] Found ${existingProductsMap.size} existing products`);

    // OPTIMIZACIÓN: Usar batch writes para operaciones atómicas (máximo 500 operaciones)
    const batch = firestore.batch();
    const now = nowTimestamp();

    // Procesar cada producto
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      
      try {
        const existingProduct = existingProductsMap.get(product.slug);

        if (existingProduct && !overwriteExisting) {
          results.skipped++;
          results.errors.push({
            index: i,
            name: product.name,
            slug: product.slug,
            error: 'Product with this slug already exists',
            isTransient: false // Error permanente, no reintentar
          });
          continue;
        }

        // Crear o actualizar producto
        const productData = {
          ...product,
          createdAt: existingProduct ? existingProduct.createdAt : now,
          updatedAt: now
        };

        if (existingProduct) {
          // Actualizar existente en el batch
          const docRef = collectionRef('products').doc(existingProduct.id);
          batch.update(docRef, productData);
          results.createdIds.push(existingProduct.id);
        } else {
          // Crear nuevo en el batch
          const docRef = collectionRef('products').doc();
          batch.set(docRef, productData);
          results.createdIds.push(docRef.id);
        }

        results.successful++;

      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push({
          index: i,
          name: product.name,
          slug: product.slug,
          error: errorMessage,
          isTransient: isTransientError(error) // Marcar si es transitorio
        });
        console.error(`[INVENTORY UPLOAD] Error processing product ${i} (${product.slug}):`, errorMessage);
      }
    }

    // OPTIMIZACIÓN: Commit todas las operaciones de una vez
    if (results.successful > 0) {
      try {
        await batch.commit();
        console.log(`[INVENTORY UPLOAD] Batch committed successfully with ${results.successful} operations`);
      } catch (error) {
        console.error(`[INVENTORY UPLOAD] Batch commit failed:`, error);
        return fail(res, 'Failed to commit batch operations', 500);
      }
    }

    // Log de resultados finales
    const transientErrors = results.errors.filter(e => e.isTransient).length;
    const permanentErrors = results.errors.filter(e => !e.isTransient).length;
    
    console.log(`[INVENTORY UPLOAD] Batch completed:`, {
      origin: req.headers.origin || 'unknown',
      totalProcessed: results.totalProcessed,
      successful: results.successful,
      failed: results.failed,
      skipped: results.skipped,
      transientErrors,
      permanentErrors,
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
