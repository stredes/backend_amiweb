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
