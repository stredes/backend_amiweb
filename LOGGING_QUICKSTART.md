# 📋 Sistema de Logging - Guía Rápida

## 🚀 Uso Básico

```typescript
import { logger } from './src/utils/logger';
import { createRequestLogger } from './src/middleware/requestLogger';
import { handleError } from './src/utils/errorHandler';

export default async function handler(req, res) {
  const requestLogger = createRequestLogger(req, res);
  
  try {
    // Tu código aquí
    logger.info('Operación exitosa');
    
    requestLogger.end(200);
    return ok(res, { success: true });
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, { endpoint: '/api/endpoint' });
  }
}
```

## 📊 Niveles de Log

| Nivel | Uso | Ejemplo |
|-------|-----|---------|
| **ERROR** | Errores críticos | `logger.error('Fallo crítico', error, context)` |
| **WARN** | Advertencias | `logger.warn('Límite cercano', { usage: '85%' })` |
| **INFO** | Eventos importantes | `logger.info('Operación completada', { id })` |
| **DEBUG** | Detalles técnicos | `logger.debug('Estado interno', { state })` |

## 🔧 Funciones Principales

### 1. Logs Generales
```typescript
logger.error('Mensaje', error, { contexto });
logger.warn('Mensaje', { contexto });
logger.info('Mensaje', { contexto });
logger.debug('Mensaje', { contexto });
```

### 2. Logs de Requests
```typescript
const requestLogger = createRequestLogger(req, res);
// ... código ...
requestLogger.end(statusCode);
```

### 3. Logs de Autenticación
```typescript
logger.auth('Usuario autenticado', userId, true);
logger.auth('Fallo de autenticación', undefined, false);
```

### 4. Logs de Base de Datos
```typescript
const start = Date.now();
await dbOperation();
logger.database('query', 'products', true, Date.now() - start);
```

### 5. Eventos de Negocio
```typescript
logger.event('product.created', { productId, name });
logger.event('order.completed', { orderId, amount });
```

## 📁 Archivos del Sistema

- **Logger principal**: [`src/utils/logger.ts`](src/utils/logger.ts)
- **Request middleware**: [`src/middleware/requestLogger.ts`](src/middleware/requestLogger.ts)
- **Error handler**: [`src/utils/errorHandler.ts`](src/utils/errorHandler.ts)
- **Documentación completa**: [`docs/LOGGING_SYSTEM.md`](docs/LOGGING_SYSTEM.md)
- **Ejemplos**: [`docs/logging-examples.ts`](docs/logging-examples.ts)

## 🎯 Eventos Automáticos

El sistema registra automáticamente:

- ✅ Todas las requests HTTP (método, endpoint, duración, código de estado)
- ✅ Autenticaciones exitosas y fallidas
- ✅ Eventos de negocio (creación/actualización de recursos)
- ✅ Requests lentas (>3 segundos)
- ✅ Accesos denegados y errores de permisos
- ✅ Orígenes CORS bloqueados

## 💡 Tips

1. **Siempre usa RequestLogger**: Captura métricas automáticamente
2. **Incluye contexto**: Facilita el debugging
3. **No loggees datos sensibles**: Contraseñas, tokens, etc.
4. **Usa el nivel apropiado**: ERROR solo para errores reales
5. **Mide operaciones largas**: Log duración de operaciones de DB

## 📖 Ver Más

Para documentación completa, ejemplos y mejores prácticas, ver:
- [📚 Documentación Completa](docs/LOGGING_SYSTEM.md)
- [💻 Ejemplos de Código](docs/logging-examples.ts)
