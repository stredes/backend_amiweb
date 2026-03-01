# API Changelog

## [Unreleased]
### Added
- 

### Changed
- 

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

