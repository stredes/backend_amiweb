# Backend AMIWEB (Vercel + Firebase)

Backend serverless para AMILAB (e-commerce B2B) usando Vercel Functions + Firestore.

## Estructura
- `api/` Endpoints REST (Vercel Functions)
- `src/` Configuración, modelos, validación, helpers

## Requisitos
- Node.js 20+
- Firebase project configurado
- Variables de entorno configuradas

## Instalación
```bash
npm install
```

## Configuración
1. Copia `.env.example` a `.env`
2. Configura las variables de Firebase:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY` (usa `\n` para saltos de línea)
   - `NODE_ENV`

## Desarrollo local
```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

## Variables de entorno
Copia `.env.example` a `.env` y configura:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (usa `\n` para saltos de línea)
- `NODE_ENV`

En Vercel, configura estas variables en Project Settings.

## Deploy
```bash
vercel
```

## Validación rápida
```bash
npm run type-check
npm run test:unit
npm run smoke:api -- https://backend-amiweb.vercel.app
```

## Endpoints
Base: `https://amilab-api.vercel.app/api` (placeholder)

### Salud
- `GET /api/health`
- `GET /api/ready`

### Metadata
- `GET /api/metadata`

### Búsqueda
- `GET /api/search?q=term&limit=20&scope=catalog|global`

### Admin
- `GET /api/admin/kpis`
- `GET /api/admin/clients`
- `GET /api/admin/operations`
- `GET /api/admin/approvals/pending`
- `GET /api/admin/exports/executive`
- `GET /api/admin/exports/orders`
- `GET /api/admin/exports/clients`

### Vendor
- `GET /api/vendor/kpis`
- `GET /api/vendor/pipeline`
- `GET /api/vendor/agenda`
- `GET /api/vendor/clients`
- `GET /api/vendor/orders`
- `GET /api/vendor/quotes/pending`
- `POST /api/vendor/quotes/{id}/approve`
- `POST /api/vendor/quotes/{id}/reject`
- `GET /api/vendor/exports/orders.csv`
- `GET /api/vendor/exports/clients.csv`
- `GET /api/vendor/exports/pipeline.csv`

### Categorías
- `GET /api/categories`
- `GET /api/categories/{id}`
- `POST /api/categories`
- `PUT /api/categories/{id}`
- `DELETE /api/categories/{id}` (soft delete)

### Productos
- `GET /api/products?categoryId=&search=&page=&pageSize=`
- `GET /api/products/{id}`
- `GET /api/products/slug/{slug}`
- `POST /api/products`
- `PUT /api/products/{id}`
- `DELETE /api/products/{id}` (soft delete)

### Soporte
- `POST /api/support-requests`
- `GET /api/support-requests?status=&serviceType=&email=&page=&pageSize=`
- `GET /api/support-requests/{id}`
- `PATCH /api/support-requests/{id}/status`

### Contacto
- `POST /api/contact-messages`
- `GET /api/contact-messages?page=&pageSize=`

## Integración con el frontend
El frontend (Vite/React) debe consumir:
- `/api/categories` y `/api/products` para catálogo.
- `/api/support-requests` para soporte.
- `/api/contact-messages` para contacto.
- `/api/metadata` para textos dinámicos.

Si el frontend y backend se despliegan juntos en Vercel, se puede usar el mismo dominio.

## Características Implementadas

✅ **Autenticación con Firebase Auth** - Middleware para proteger endpoints  
✅ **CORS Configurado** - Soporta múltiples orígenes incluyendo localhost  
✅ **Validación con Zod** - Validación de esquemas en entrada y configuración  
✅ **Error Handler Centralizado** - Logs estructurados y respuestas consistentes  
✅ **Sistema de Logging Global** - Logging completo de errores, eventos y requests ([Ver docs](LOGGING_QUICKSTART.md))  
✅ **TypeScript Strict** - Tipado completo con compilación validada  
✅ **Búsqueda Optimizada** - Campo searchKeywords para productos  
✅ **Soft Deletes** - Preserva integridad de datos  
✅ **Paginación** - Implementada en todos los endpoints de listado  

## Sistema de Logging

El backend incluye un sistema completo de logging que registra automáticamente:

- 🔍 **Todas las requests HTTP** - Método, endpoint, duración, código de estado
- 🔐 **Eventos de autenticación** - Logins exitosos y fallidos
- 📊 **Operaciones de base de datos** - Queries, creates, updates, deletes con duración
- 🎯 **Eventos de negocio** - Creación de productos, pedidos, etc.
- ⚠️ **Errores y advertencias** - Con stack traces y contexto completo
- 🐌 **Requests lentas** - Alertas automáticas para requests >3s

**Guías rápidas:**
- [📋 Quick Start](LOGGING_QUICKSTART.md) - Uso básico y ejemplos
- [📚 Documentación Completa](docs/LOGGING_SYSTEM.md) - Todos los detalles
- [💻 Ejemplos de Código](docs/logging-examples.ts) - Casos de uso

## TODO
- [ ] Implementar rate limiting con Vercel KV
- [ ] Optimizar búsqueda global con índice dedicado (Algolia/MeiliSearch)
- [ ] Implementar caché con Redis
- [ ] Integrar Sentry para error tracking
- [ ] Integraciones externas (correo, CRM, ERP)
- [ ] Pruebas E2E por rol en staging
- [ ] Webhooks para notificaciones
