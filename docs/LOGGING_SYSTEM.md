# Sistema de Logging Global

## Descripción

Sistema de logging centralizado implementado para capturar todos los eventos, errores y actividades del backend. Proporciona visibilidad completa de la aplicación y facilita el debugging y monitoreo.

## Características

### Niveles de Log

- **ERROR**: Errores críticos y excepciones
- **WARN**: Advertencias y situaciones anómalas
- **INFO**: Eventos informativos importantes
- **DEBUG**: Información detallada para debugging (solo en desarrollo)

### Tipos de Logs

#### 1. Logs de Errores
```typescript
import { logger } from './src/utils/logger';

logger.error('Error al procesar producto', error, {
  productId: '123',
  operation: 'update'
});
```

#### 2. Logs de Requests HTTP
```typescript
import { createRequestLogger } from './src/middleware/requestLogger';

const requestLogger = createRequestLogger(req, res);
// ... procesar request ...
requestLogger.end(200);
```

#### 3. Logs de Autenticación
```typescript
logger.auth('Usuario autenticado exitosamente', userId, true);
logger.auth('Fallo de autenticación', undefined, false);
```

#### 4. Logs de Base de Datos
```typescript
logger.database('query', 'products', true, 150); // 150ms
logger.database('create', 'categories', true, 50);
```

#### 5. Logs de Eventos de Negocio
```typescript
logger.event('product.created', { productId, name });
logger.event('inventory.uploaded', { itemCount: 100 });
```

#### 6. Logs Generales
```typescript
logger.info('Operación completada', { details });
logger.warn('Límite de rate casi alcanzado', { requests: 95 });
logger.debug('Estado interno', { state });
```

## Formato de Logs

### Desarrollo
Logs legibles con emojis y formato estructurado:
```
ℹ️ [INFO] 2026-01-08T10:30:00.000Z
  Message: Request iniciado: GET /api/products
  Request: GET /api/products
  Context: {
    "userId": "abc123",
    "ip": "192.168.1.1"
  }
---
```

### Producción
JSON estructurado para sistemas de monitoreo:
```json
{
  "level": "INFO",
  "timestamp": "2026-01-08T10:30:00.000Z",
  "message": "Request iniciado: GET /api/products",
  "request": {
    "method": "GET",
    "endpoint": "/api/products",
    "userId": "abc123",
    "ip": "192.168.1.1"
  },
  "environment": "production"
}
```

## Integración en Endpoints

### Ejemplo Completo

```typescript
import { VercelRequest, VercelResponse } from '@vercel/node';
import { createRequestLogger } from '../middleware/requestLogger';
import { logger } from '../utils/logger';
import { handleError } from '../utils/errorHandler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);
  
  try {
    if (req.method === 'POST') {
      logger.debug('Procesando creación', { body: req.body });
      
      // Operación de base de datos
      const dbStart = Date.now();
      const result = await database.create(data);
      logger.database('create', 'collection', true, Date.now() - dbStart);
      
      // Evento de negocio
      logger.event('resource.created', { id: result.id });
      logger.info('Recurso creado exitosamente', { id: result.id });
      
      requestLogger.end(201);
      return ok(res, result, 201);
    }
    
    requestLogger.end(405);
    return fail(res, 'Method not allowed', 405);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/resource',
      method: req.method
    });
  }
}
```

## Eventos de Negocio Automáticos

El `RequestLogger` registra automáticamente eventos de negocio basados en:

- **Productos**:
  - `product.created` - POST a /products (201)
  - `product.updated` - PUT a /products (200)
  - `product.deleted` - DELETE a /products (200)

- **Categorías**:
  - `category.created` - POST a /categories (201)
  - `category.updated` - PUT a /categories (200)

- **Contacto**:
  - `contact.message.received` - POST a /contact-messages (201)

- **Soporte**:
  - `support.request.created` - POST a /support-requests (201)
  - `support.request.updated` - PUT a /support-requests (200)

- **Inventario**:
  - `inventory.uploaded` - POST a /inventory/upload (200)

## Alertas Automáticas

### Requests Lentas
Logs de advertencia automáticos para requests que toman >3 segundos:
```typescript
logger.warn('Request lenta detectada', {
  method: 'GET',
  endpoint: '/api/products',
  duration: '3500ms',
  statusCode: 200
});
```

### Orígenes CORS No Permitidos
```typescript
logger.warn('CORS: Origen no permitido bloqueado', {
  origin: 'https://malicious-site.com',
  endpoint: '/api/products'
});
```

### Accesos Admin Denegados
```typescript
logger.warn('Intento de acceso admin denegado', {
  userId: 'user123',
  role: 'user',
  endpoint: '/api/admin/settings'
});
```

## Información Capturada

### Request Logs
- Método HTTP
- URL/Endpoint
- Código de estado
- Duración (ms)
- User ID (si está autenticado)
- IP del cliente
- User Agent

### Error Logs
- Mensaje de error
- Stack trace
- Contexto de ejecución
- User ID (si aplica)
- Endpoint afectado

### Database Logs
- Tipo de operación (query, create, update, delete)
- Colección
- Éxito/Fallo
- Duración

## Integración con Servicios de Monitoreo

El formato JSON en producción es compatible con:
- **Sentry** - Error tracking
- **LogRocket** - Session replay y logging
- **Datadog** - Monitoreo y analítica
- **New Relic** - APM y logging
- **CloudWatch** - AWS logging (si se migra)

## Variables de Ambiente

```bash
# Habilitar modo debug en producción (no recomendado)
DEBUG=true

# Ambiente (determina formato de logs)
NODE_ENV=production
```

## Mejores Prácticas

1. **Usar el nivel apropiado**:
   - ERROR: Solo errores que requieren atención
   - WARN: Situaciones anómalas pero manejables
   - INFO: Eventos importantes de negocio
   - DEBUG: Detalles técnicos

2. **Incluir contexto relevante**:
   ```typescript
   logger.error('Fallo al crear producto', error, {
     productId,
     userId,
     categoryId,
     operation: 'create'
   });
   ```

3. **No loggear información sensible**:
   - ❌ Contraseñas, tokens, API keys
   - ❌ Datos personales completos
   - ✅ IDs, códigos de error, métricas

4. **Usar RequestLogger en todos los endpoints**:
   ```typescript
   const requestLogger = createRequestLogger(req, res);
   // ... código ...
   requestLogger.end(statusCode);
   ```

5. **Loggear operaciones de DB largas**:
   ```typescript
   const start = Date.now();
   await operation();
   logger.database('operation', 'collection', true, Date.now() - start);
   ```

## Archivos del Sistema

- [`src/utils/logger.ts`](src/utils/logger.ts) - Logger principal
- [`src/middleware/requestLogger.ts`](src/middleware/requestLogger.ts) - Middleware de requests
- [`src/utils/errorHandler.ts`](src/utils/errorHandler.ts) - Manejo de errores con logging
- [`src/middleware/auth.ts`](src/middleware/auth.ts) - Auth con logging
- [`src/middleware/cors.ts`](src/middleware/cors.ts) - CORS con logging

## Ejemplo de Salida (Desarrollo)

```
ℹ️ [INFO] 2026-01-08T10:30:00.123Z
  Message: Request iniciado: POST /api/products
  Request: POST /api/products
  Context: {
    "userId": "user123",
    "ip": "192.168.1.1"
  }
---
🔍 [DEBUG] 2026-01-08T10:30:00.150Z
  Message: Database create on products
  Context: {
    "success": true,
    "duration": "25ms"
  }
---
ℹ️ [INFO] 2026-01-08T10:30:00.151Z
  Message: Event: product.created
  Context: {
    "productId": "prod_abc123",
    "name": "Nuevo Producto"
  }
---
ℹ️ [INFO] 2026-01-08T10:30:00.152Z
  Message: POST /api/products - 201
  Request: POST /api/products
  User: user123
  Context: {
    "duration": "29ms"
  }
---
```

## Próximos Pasos

1. Integrar con Sentry para error tracking en producción
2. Configurar alertas para errores críticos
3. Dashboard de métricas basado en logs
4. Retención de logs y análisis histórico
5. Rate limiting basado en logs de requests
