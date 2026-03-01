# Backend Checklist + Fixes (Front Sync)

Fecha: 2026-03-01
Estado: auditoría ejecutada + fixes aplicados.

## Resumen
- Total checks: 9
- Cumplidos: 9
- Pendientes: 0

## Checklist detallado

1. Respuesta uniforme (`success/data` y `success/error/code/details`)
- Estado: OK
- Evidencia: `src/utils/responses.ts`
- Fix aplicado: normalización de `code` por status y `details` con `requestId`.

2. `x-request-id` en todas las respuestas
- Estado: OK
- Evidencia: `api/index.ts` (asigna header para toda request enroutada)
- Fix aplicado: ya existente, validado.

3. CORS estable (orígenes/métodos/headers/preflight)
- Estado: OK
- Evidencia: `src/middleware/cors.ts`
- Fix aplicado: soporte para `https://amilab.cl`, env `CORS_ALLOWED_ORIGINS` y `CORS_ALLOW_VERCEL_PREVIEWS`.

4. Auth semántico (401 TOKEN_*, 403 FORBIDDEN)
- Estado: OK
- Evidencia: `src/middleware/auth.ts`
- Fix aplicado: `TOKEN_MISSING`, `TOKEN_INVALID`, `TOKEN_EXPIRED`.

5. Usuarios paginados (`items`) con compatibilidad `users`
- Estado: OK
- Evidencia:
  - `api_handlers/users/index.ts`
  - `api_handlers/users/role/[role].ts`
- Fix aplicado: respuestas incluyen `items` y `users` durante transición.

6. Compatibilidad de rutas en transición de versionado (`/api` y `/api/v1`)
- Estado: OK
- Evidencia: `api/index.ts` (`getPathFromRequest` normaliza `/api/v1/* -> /api/*`)
- Fix aplicado: paridad sin breaking.

7. Healthchecks claros
- Estado: OK
- Evidencia:
  - `GET /api/health` en `api_handlers/health.ts`
  - `GET /api/ready` en `api_handlers/ready.ts`
- Fix aplicado: nuevo endpoint `ready` con verificación Firebase/Firestore.

8. Observabilidad trazable por request ID en logs
- Estado: OK
- Evidencia:
  - `src/middleware/requestLogger.ts`
  - `src/utils/logger.ts`
- Fix aplicado: `requestId` incluido en logs de inicio/fin y warning de lentitud.

9. Changelog por release
- Estado: OK (plantilla)
- Evidencia: `docs/API_CHANGELOG.md`
- Fix aplicado: plantilla inicial para registrar cambios por release.

## Verificación recomendada post-deploy
- `GET /api/health` -> 200
- `GET /api/ready` -> 200 (o 503 si dependencia caída)
- `OPTIONS /api/products` con origen front -> 204 y `Access-Control-Allow-Origin`
- `GET /api/v1/health` -> paridad con `/api/health`
- `GET /api/auth/me` sin token -> 401 `TOKEN_MISSING`

