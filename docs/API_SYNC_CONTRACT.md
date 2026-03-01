# Front-Backend Sync Contract (AMIWEB)

Documento oficial para alinear integración Front ↔ Backend.
Fecha: 2026-03-01.

## 1) Base URL y versionado

### Ambientes
- Dev backend: `http://localhost:3000`
- Preview backend: `https://backend-amiweb-<preview>.vercel.app`
- Prod backend: `https://backend-amiweb.vercel.app`

### Regla de versionado
- Fase actual (legacy): `/api/*`
- Regla objetivo: `/api/v1/*`
- Política: nuevos contratos deben nacer en `/api/v1`; cambios breaking no se aplican en endpoints legacy sin ventana de migración.

## 2) Contrato de respuesta

### Éxito
```json
{
  "success": true,
  "data": {}
}
```

### Error
```json
{
  "success": false,
  "error": "Mensaje legible",
  "code": "ERROR_CODE_STABLE",
  "details": {
    "requestId": "uuid",
    "payload": {}
  }
}
```

## 3) Trazabilidad
- Header obligatorio en respuesta: `x-request-id`.
- Header opcional de plataforma: `x-vercel-id`.
- Regla de debugging cruzado: todo incidente front debe reportar `x-request-id`.

## 4) CORS

### Orígenes permitidos (actual)
- `http://localhost:5173`
- `http://localhost:3000`
- `http://localhost:5174`
- `https://amilab.cl`
- `https://www.amilab.cl`
- `https://amilab.vercel.app`
- `https://amiweb.vercel.app`
- `https://amiweb-theta.vercel.app`
- `https://backend-amiweb.vercel.app`

### Configuración
- Métodos: `GET, POST, PUT, PATCH, DELETE, OPTIONS`
- Headers permitidos: `Content-Type, Authorization, X-Requested-With`
- Preflight: `OPTIONS -> 204`
- Soporte dinámico por env:
  - `CORS_ALLOWED_ORIGINS` (CSV)
  - `CORS_ALLOW_VERCEL_PREVIEWS=true`

## 5) Autenticación y autorización

### Auth
- Formato: `Authorization: Bearer <Firebase ID Token>`
- Respuestas de auth inválida:
  - `401 TOKEN_MISSING`
  - `401 TOKEN_INVALID`
  - `401 TOKEN_EXPIRED`

### Semántica 401/403
- `401`: no autenticado / token inválido o expirado
- `403`: autenticado pero sin permisos

### RBAC (alto nivel)
- `root`: administración total
- `admin`: lectura operativa y administración parcial según endpoint
- Otros roles: permisos por dominio (vendedor, bodega, etc.)

## 6) Matriz mínima de endpoints de usuarios (root/admin)

- `GET /api/users`
  - Permiso: `root|admin`
  - Query: `page, pageSize, search, role, isActive`
  - Respuesta:
  ```json
  {
    "success": true,
    "data": {
      "items": [],
      "users": [],
      "total": 0,
      "page": 1,
      "pageSize": 20,
      "totalPages": 1
    }
  }
  ```

- `POST /api/users`
  - Permiso: `root`
  - Códigos típicos: `VALIDATION_ERROR`, `USER_ALREADY_EXISTS`

- `GET /api/users/:id`
  - Permiso: `root|admin`

- `PUT /api/users/:id`
  - Permiso: `root`
  - Anti-escalación aplicada (protección de root actual)

- `PATCH /api/users/:id/status`
  - Permiso: `root`

- `POST /api/users/:id/reset-password`
  - Permiso: `root`

- `DELETE /api/users/:id`
  - Permiso: `root`

- `GET /api/users/:id/audit`
  - Permiso: `root|admin`

- `GET /api/users/views/summary`
  - Permiso: `root|admin`

- `GET /api/users/role/:role`
  - Permiso: `root|admin`
  - Respuesta estándar de listado (`items,total,page,pageSize,totalPages`)

## 7) Auditoría
- Colección: `auditLogs`
- Campos esperados:
  - `action`
  - `entityType`
  - `entityId`
  - `actorId`
  - `actorEmail`
  - `actorRole`
  - `ip`
  - `userAgent`
  - `metadata` (before/after cuando aplique)
  - `createdAt`, `createdAtIso`

## 8) Paginación, filtros y orden

### Estándar de listados
- Query:
  - `page` (>=1)
  - `pageSize` (1..100)
  - `search` (opcional)
  - `role/isActive/...` según endpoint
- Respuesta mínima:
```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 20,
  "totalPages": 1
}
```
- Objetivo siguiente iteración: agregar `sort` y `hasNext` de forma global.

## 9) Catálogo/productos
- Endpoint principal: `GET /api/products`
- Filtros actuales: `page, pageSize, search, categoryId`
- Respuesta actual: `items,total,page,pageSize`
- Regla de consistencia: categorías y productos activos deben correlacionar por `categoryId`.

## 10) Healthchecks
- `GET /api/health`:
  - uso: disponibilidad base del backend
- Objetivo recomendado: `GET /api/ready`
  - uso: confirmar dependencias listas (Firestore/Auth)

## 11) Errores de negocio (catálogo base)
- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `INTERNAL_ERROR`
- `TOKEN_MISSING`
- `TOKEN_INVALID`
- `TOKEN_EXPIRED`
- `USER_ALREADY_EXISTS`

## 12) Rate limiting
- Estado: pendiente de implementación global.
- Contrato esperado para front cuando se implemente:
  - `429 TOO_MANY_REQUESTS`
  - Header recomendado: `Retry-After`

## 13) Política de tiempos/reintentos (frontend)
- GET idempotentes: retry solo en red/5xx transitorio.
- Mutaciones: no retry automático en destructivas.
- Manejo recomendado:
  - timeout por endpoint
  - backoff exponencial en transitorios

## 14) Eventos/Webhooks
- Estado actual: notificaciones internas en backend (colección de notificaciones).
- Recomendación: exponer webhook/event stream para sincronización en tiempo real front (siguiente fase).

## 15) Seeds QA/staging
- Recomendado mantener dataset mínimo reproducible:
  - 1 `root`, 1 `admin`, 1 `vendedor`, 1 `bodega`, 1 `socio`, 1 `cliente`
  - catálogo mínimo de productos/categorías
  - 1 flujo quote->order->prepare->approve->dispatch

## 16) Checklist de deploy coordinado
1. Deploy backend
2. Verificar `health`, CORS y auth codes
3. Publicar changelog API
4. Deploy frontend apuntando a URL final
5. Smoke test e2e (health, auth/me, products, users)

## 17) Changelog de API (obligatorio por release)
- Fecha efectiva
- Cambios
- Breaking / non-breaking
- Endpoint(s) afectados
- Acción requerida en frontend

## 18) Definition of Done (DoD)
- Front consume contrato uniforme y códigos estables.
- Todo error visible en UI mapea por `code`.
- Todo incidente es trazable con `x-request-id`.
- No hay deploy sin checklist de compatibilidad + changelog.
