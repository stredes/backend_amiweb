import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../../src/middleware/auth';
import { enableCors, handleCorsPreFlight } from '../../src/middleware/cors';
import { collectionRef, nowTimestamp } from '../../src/lib/firestore';
import { firestore } from '../../src/lib/firebase';
import { ok, fail } from '../../src/utils/responses';
import { handleError } from '../../src/utils/errorHandler';
import { inventoryItemSchema } from '../../src/validation/inventorySchema';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import { logger } from '../../src/utils/logger';

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
  const requestLogger = createRequestLogger(req, res);
  enableCors(req, res);

  if (handleCorsPreFlight(req, res)) {
    return;
  }

  try {
    // Log de conexión desde el frontend
    const origin = req.headers.origin || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    logger.info('📦 Recibiendo carga de inventario', {
      origin,
      userAgent: userAgent.substring(0, 100),
      method: req.method,
      userId: (req as any).user?.uid
    });

    if (req.method !== 'POST') {
      logger.warn('Método no permitido en carga de inventario', { method: req.method });
      requestLogger.end(405);
      return fail(res, 'Method not allowed', 405);
    }

    // Autenticación requerida
    const isAuthenticated = await requireAuth(req, res);
    if (!isAuthenticated) {
      return; // requireAuth ya envió la respuesta
    }

    // Validar estructura básica del payload
    if (!req.body || typeof req.body !== 'object') {
      return fail(res, 'Invalid payload: body must be a JSON object', 400);
    }

    if (!Array.isArray(req.body.products)) {
      return fail(res, 'Invalid payload: products must be an array', 400);
    }

    // Validar cada producto individualmente para dar feedback específico
    const validationErrors: Array<{ index: number; name: string; errors: string[] }> = [];
    const validProducts: any[] = [];

    req.body.products.forEach((product: any, index: number) => {
      const result = inventoryItemSchema.safeParse(product);
      
      if (!result.success) {
        const fieldErrors = result.error.issues.map(issue => {
          const field = issue.path.join('.');
          return `${field}: ${issue.message}`;
        });
        
        validationErrors.push({
          index: index + 1, // +1 para que coincida con fila del Excel (header = fila 1)
          name: product?.name || 'Sin nombre',
          errors: fieldErrors
        });
      } else {
        validProducts.push(result.data);
      }
    });

    // Si hay errores de validación, devolverlos
    if (validationErrors.length > 0) {
      const errorMessage = validationErrors.slice(0, 10).map(err => 
        `Fila ${err.index} (${err.name}): ${err.errors.join(', ')}`
      ).join('\n');

      const additionalErrors = validationErrors.length > 10 
        ? `\n... y ${validationErrors.length - 10} errores más.` 
        : '';

      logger.error('❌ Errores de validación en carga de inventario', null, {
        totalErrors: validationErrors.length,
        errors: validationErrors.slice(0, 5),
        userId: (req as any).user?.uid
      });
      
      requestLogger.end(400);
      return fail(res, `Errores de validación encontrados:\n${errorMessage}${additionalErrors}`, 400);
    }

    // Si no hay productos válidos después de validar
    if (validProducts.length === 0) {
      logger.warn('No hay productos válidos para procesar', { userId: (req as any).user?.uid });
      requestLogger.end(400);
      return fail(res, 'No hay productos válidos para procesar', 400);
    }

    const products = validProducts;
    const overwriteExisting = req.body.overwriteExisting ?? false;

    // Log de parámetros recibidos
    logger.info('🔄 Procesando batch de inventario', {
      origin: req.headers.origin || 'unknown',
      productsCount: products.length,
      overwriteExisting,
      userId: (req as any).user?.uid
    });

    if (products.length === 0) {
      logger.warn('Batch vacío recibido');
      requestLogger.end(400);
      return fail(res, 'No products to process', 400);
    }

    if (products.length > 500) {
      logger.error('Batch demasiado grande', null, { size: products.length, maxAllowed: 500 });
      requestLogger.end(400);
      return fail(res, 'Maximum 500 products per batch. Recommended: 200 for optimal performance', 400);
    }

    // Advertir si el lote es muy grande (mayor a 200)
    if (products.length > 200) {
      logger.warn('⚠️ Batch grande detectado', { 
        size: products.length, 
        recommended: 200,
        message: 'Considera usar batches de 200 para mejor performance'
      });
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

    logger.info('🔍 Productos existentes encontrados', { 
      count: existingProductsMap.size,
      totalToProcess: products.length
    });

    // Helper: Generar slug único si hay duplicados
    const generateUniqueSlug = (baseSlug: string, existingSlugs: Set<string>): string => {
      let slug = baseSlug;
      let counter = 1;
      
      while (existingSlugs.has(slug)) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      
      return slug;
    };

    // Rastrear slugs que vamos a usar en este batch
    const usedSlugs = new Set<string>(existingProductsMap.keys());

    // OPTIMIZACIÓN: Usar batch writes para operaciones atómicas (máximo 500 operaciones)
    const batch = firestore.batch();
    const now = nowTimestamp();

    // Procesar cada producto
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      
      try {
        // Generar slug único si el actual está duplicado
        let finalSlug = product.slug;
        
        if (usedSlugs.has(finalSlug) && !overwriteExisting) {
          finalSlug = generateUniqueSlug(product.slug, usedSlugs);
          logger.debug('🔄 Slug duplicado ajustado', { 
            original: product.slug, 
            nuevo: finalSlug,
            producto: product.name
          });
        }
        
        usedSlugs.add(finalSlug);
        
        const existingProduct = existingProductsMap.get(finalSlug);

        if (existingProduct && !overwriteExisting) {
          results.skipped++;
          results.errors.push({
            index: i,
            name: product.name,
            slug: finalSlug,
            error: 'Product with this slug already exists',
            isTransient: false // Error permanente, no reintentar
          });
          continue;
        }

        // Crear o actualizar producto con slug final
        const productData = {
          ...product,
          slug: finalSlug, // Usar slug único generado
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
        const isTransient = isTransientError(error);
        
        results.errors.push({
          index: i,
          name: product.name,
          slug: product.slug,
          error: errorMessage,
          isTransient
        });
        
        logger.error(`❌ Error procesando producto #${i}`, error, {
          productName: product.name,
          slug: product.slug,
          isTransient,
          canRetry: isTransient
        });
      }
    }

    // OPTIMIZACIÓN: Commit todas las operaciones de una vez
    if (results.successful > 0) {
      try {
        const dbStart = Date.now();
        await batch.commit();
        const dbDuration = Date.now() - dbStart;
        
        logger.database('batch-commit', 'products', true, dbDuration);
        logger.info('✅ Batch committed exitosamente', { 
          operations: results.successful,
          duration: `${dbDuration}ms`
        });
      } catch (error) {
        logger.error('❌ Fallo al hacer commit del batch', error);
        requestLogger.end(500);
        return fail(res, 'Failed to commit batch operations', 500);
      }
    }

    // Log de resultados finales
    const transientErrors = results.errors.filter(e => e.isTransient).length;
    const permanentErrors = results.errors.filter(e => !e.isTransient).length;
    
    // Log detallado de errores
    if (results.errors.length > 0) {
      logger.warn('⚠️ Errores en carga de inventario', {
        total: results.errors.length,
        transient: transientErrors,
        permanent: permanentErrors,
        details: results.errors.slice(0, 5).map(e => ({
          index: e.index,
          name: e.name,
          slug: e.slug,
          error: e.error,
          canRetry: e.isTransient
        }))
      });
    }
    
    logger.event('inventory.uploaded', {
      totalProcessed: results.totalProcessed,
      successful: results.successful,
      failed: results.failed,
      skipped: results.skipped,
      userId: (req as any).user?.uid
    });
    
    logger.info('🎉 Carga de inventario completada', {
      origin: req.headers.origin || 'unknown',
      totalProcessed: results.totalProcessed,
      successful: results.successful,
      failed: results.failed,
      skipped: results.skipped,
      transientErrors,
      permanentErrors,
      successRate: `${((results.successful / results.totalProcessed) * 100).toFixed(1)}%`
    });

    requestLogger.end(201);
    return ok(res, results, 201);

  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/inventory/upload',
      method: req.method || 'POST',
      userId: (req as any).user?.uid
    });
  }
}
