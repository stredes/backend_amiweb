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

## Endpoints
Base: `https://amilab-api.vercel.app/api` (placeholder)

### Salud
- `GET /api/health`

### Metadata
- `GET /api/metadata`

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
✅ **TypeScript Strict** - Tipado completo con compilación validada  
✅ **Búsqueda Optimizada** - Campo searchKeywords para productos  
✅ **Soft Deletes** - Preserva integridad de datos  
✅ **Paginación** - Implementada en todos los endpoints de listado  

## TODO
- [ ] Implementar rate limiting con Vercel KV
- [ ] Agregar índices de búsqueda (Algolia/MeiliSearch)
- [ ] Implementar caché con Redis
- [ ] Panel de administración
- [ ] Integraciones externas (correo, CRM, ERP)
- [ ] Tests unitarios y de integración
- [ ] Webhooks para notificaciones
- [ ] Monitoreo con Sentry
