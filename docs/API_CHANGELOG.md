# API Changelog

## [Unreleased]
### Added
- Endpoints de panel administrativo:
  - `GET /api/admin/kpis`
  - `GET /api/admin/clients`
  - `GET /api/admin/operations`
  - `GET /api/admin/approvals/pending`
  - `GET /api/admin/exports/executive`
  - `GET /api/admin/exports/orders`
  - `GET /api/admin/exports/clients`
- Utilidades de agregación para métricas administrativas en `src/utils/adminDashboard.ts`.
- Test `tests/admin-dashboard.test.ts` para validación de KPIs y correlación operacional.
- Endpoints comerciales de vendedor:
  - `GET /api/vendor/kpis`
  - `GET /api/vendor/pipeline`
  - `GET /api/vendor/agenda`
  - `GET /api/vendor/clients`
  - `GET /api/vendor/quotes/pending`
  - `POST /api/vendor/quotes/:id/approve`
  - `POST /api/vendor/quotes/:id/reject`
  - `GET /api/vendor/orders`
  - `GET /api/vendor/exports/orders.csv`
  - `GET /api/vendor/exports/clients.csv`
  - `GET /api/vendor/exports/pipeline.csv`
- Utilidades `src/utils/vendorDashboard.ts` + test `tests/vendor-dashboard.test.ts`.
- Endpoint `GET /api/search` (scope `catalog|global`) para búsqueda global por nombre/código/marca/categoría y entidades comerciales autenticadas.
- Contrato OpenAPI congelado en `docs/openapi.v1.yaml`.
- Runbook y checklist operativo en `docs/GO_LIVE_RUNBOOK.md` + `scripts/smoke-api.sh`.

### Changed
- Documentación de contrato Front↔Backend actualizada con endpoints admin.

### Fixed
- 

### Breaking
- 

---

## [2026-03-01]
### Added
- `GET /api/ready` endpoint para readiness de dependencias.
- Compatibilidad de rutas `/api/v1/*` normalizada a handlers existentes de `/api/*`.

### Changed
- Contrato uniforme de errores consolidado con `code` y `details`.
- `x-request-id` propagado a logs de request.

### Fixed
- CORS ampliado para `https://amilab.cl` y configuración dinámica por entorno.

### Breaking
- Ninguno.
