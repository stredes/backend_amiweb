/**
 * Ejemplos de uso del sistema de logging
 * Este archivo muestra diferentes casos de uso del logger
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { logger } from '../src/utils/logger';
import { createRequestLogger } from '../src/middleware/requestLogger';
import { handleError } from '../src/utils/errorHandler';
import { ok, fail } from '../src/utils/responses';

// ============================================
// EJEMPLO 1: Endpoint con logging completo
// ============================================
export async function exampleEndpoint(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);
  
  try {
    // Log de inicio de operación
    logger.info('Iniciando operación de ejemplo', {
      userId: (req as any).user?.uid,
      params: req.query
    });

    // Simular operación de base de datos
    const dbStart = Date.now();
    // await database.query(...)
    const dbDuration = Date.now() - dbStart;
    logger.database('query', 'example_collection', true, dbDuration);

    // Log de evento de negocio
    logger.event('example.operation.completed', {
      userId: (req as any).user?.uid,
      resultCount: 10
    });

    requestLogger.end(200);
    return ok(res, { success: true });
    
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/example',
      method: req.method,
      userId: (req as any).user?.uid
    });
  }
}

// ============================================
// EJEMPLO 2: Logging de errores personalizados
// ============================================
async function processData(data: any) {
  try {
    if (!data.id) {
      logger.warn('Datos incompletos recibidos', { data });
      throw new Error('ID requerido');
    }

    // Operación exitosa
    logger.info('Datos procesados correctamente', {
      id: data.id,
      timestamp: new Date().toISOString()
    });

    return { success: true };
    
  } catch (error) {
    logger.error('Error procesando datos', error, {
      data,
      operation: 'processData'
    });
    throw error;
  }
}

// ============================================
// EJEMPLO 3: Logging de autenticación
// ============================================
async function customAuthFlow(token: string) {
  try {
    logger.debug('Validando token de autenticación', {
      tokenLength: token.length
    });

    // Simular validación
    const userId = 'user123';
    
    logger.auth('Usuario autenticado con token personalizado', userId, true);
    logger.info('Inicio de sesión exitoso', {
      userId,
      loginMethod: 'custom'
    });

    return { userId };
    
  } catch (error) {
    logger.auth('Fallo de autenticación personalizada', undefined, false);
    logger.error('Error en flujo de autenticación', error);
    throw error;
  }
}

// ============================================
// EJEMPLO 4: Logging de operaciones de base de datos
// ============================================
async function databaseOperations() {
  // CREATE
  const createStart = Date.now();
  // await db.create(...)
  logger.database('create', 'users', true, Date.now() - createStart);
  logger.event('user.created', { userId: 'new_user_123' });

  // READ
  const readStart = Date.now();
  // const result = await db.read(...)
  logger.database('query', 'users', true, Date.now() - readStart);

  // UPDATE
  const updateStart = Date.now();
  // await db.update(...)
  logger.database('update', 'users', true, Date.now() - updateStart);
  logger.event('user.updated', { userId: 'user_123', fields: ['email', 'name'] });

  // DELETE
  const deleteStart = Date.now();
  // await db.delete(...)
  logger.database('delete', 'users', true, Date.now() - deleteStart);
  logger.event('user.deleted', { userId: 'user_123' });
}

// ============================================
// EJEMPLO 5: Logging de eventos de negocio
// ============================================
async function businessEventExamples() {
  // Evento de compra
  logger.event('purchase.completed', {
    orderId: 'order_123',
    userId: 'user_456',
    amount: 99.99,
    items: 3
  });

  // Evento de envío
  logger.event('order.shipped', {
    orderId: 'order_123',
    trackingNumber: 'TRACK123',
    carrier: 'express'
  });

  // Evento de registro
  logger.event('user.registered', {
    userId: 'user_789',
    method: 'email',
    source: 'landing_page'
  });

  // Evento de error de negocio
  logger.warn('Producto sin stock', {
    productId: 'prod_123',
    requestedQuantity: 5,
    availableStock: 2
  });
}

// ============================================
// EJEMPLO 6: Logging de diferentes niveles
// ============================================
function loggingLevels() {
  // ERROR - Solo para errores reales
  logger.error('Fallo crítico en el sistema', new Error('Database connection failed'), {
    component: 'database',
    severity: 'critical'
  });

  // WARN - Situaciones anómalas pero manejables
  logger.warn('Tasa de uso alta detectada', {
    usage: '85%',
    threshold: '80%',
    component: 'api'
  });

  // INFO - Eventos importantes de negocio
  logger.info('Nuevo pedido recibido', {
    orderId: 'order_123',
    customer: 'customer_456',
    amount: 149.99
  });

  // DEBUG - Información técnica detallada (solo desarrollo)
  logger.debug('Estado de la cache', {
    hitRate: 0.85,
    entries: 1234,
    memoryUsage: '45MB'
  });
}

// ============================================
// EJEMPLO 7: Logging con contexto extendido
// ============================================
async function complexOperation(req: VercelRequest) {
  const context = {
    userId: (req as any).user?.uid,
    sessionId: req.headers['x-session-id'],
    userAgent: req.headers['user-agent'],
    ip: req.headers['x-forwarded-for'],
    endpoint: req.url,
    method: req.method
  };

  try {
    logger.info('Operación compleja iniciada', context);

    // Step 1
    logger.debug('Paso 1: Validación', { ...context, step: 1 });
    // ...

    // Step 2
    logger.debug('Paso 2: Procesamiento', { ...context, step: 2 });
    // ...

    // Step 3
    logger.debug('Paso 3: Almacenamiento', { ...context, step: 3 });
    // ...

    logger.info('Operación compleja completada', {
      ...context,
      duration: '1234ms',
      success: true
    });

  } catch (error) {
    logger.error('Fallo en operación compleja', error, context);
    throw error;
  }
}

// ============================================
// EJEMPLO 8: Integración completa en endpoint
// ============================================
export async function fullIntegrationExample(req: VercelRequest, res: VercelResponse) {
  // 1. Iniciar logging de request
  const requestLogger = createRequestLogger(req, res);
  
  try {
    // 2. Log de inicio
    logger.info('Procesando solicitud de creación', {
      endpoint: req.url,
      userId: (req as any).user?.uid
    });

    // 3. Validación con logging
    if (!req.body.name) {
      logger.warn('Validación fallida: nombre requerido', {
        body: req.body
      });
      requestLogger.end(400);
      return fail(res, 'Name is required', 400);
    }

    // 4. Operación de base de datos con logging
    const dbStart = Date.now();
    // const result = await db.create(req.body);
    const dbDuration = Date.now() - dbStart;
    logger.database('create', 'items', true, dbDuration);

    // 5. Evento de negocio
    logger.event('item.created', {
      itemId: 'item_123',
      userId: (req as any).user?.uid,
      name: req.body.name
    });

    // 6. Log de éxito
    logger.info('Item creado exitosamente', {
      itemId: 'item_123',
      duration: dbDuration
    });

    // 7. Finalizar request logging
    requestLogger.end(201);
    return ok(res, { id: 'item_123', ...req.body }, 201);

  } catch (error) {
    // 8. Manejo de error con logging
    logger.error('Error creando item', error, {
      endpoint: req.url,
      userId: (req as any).user?.uid,
      body: req.body
    });

    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: req.url,
      method: req.method,
      userId: (req as any).user?.uid
    });
  }
}

// ============================================
// EXPORT de ejemplos para testing
// ============================================
export const examples = {
  exampleEndpoint,
  processData,
  customAuthFlow,
  databaseOperations,
  businessEventExamples,
  loggingLevels,
  complexOperation,
  fullIntegrationExample
};
