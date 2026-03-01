# Release Signoff - 2026-03-01

## Alcance cerrado
- Contrato API congelado en `docs/openapi.v1.yaml`.
- Compatibilidad `/api` y `/api/v1` activa.
- Endpoints admin + vendor habilitados.
- Endpoint búsqueda global `/api/search` habilitado.
- Runbook y smoke checklist definidos.

## Evidencia técnica
- `npm run type-check` exitoso.
- Tests unitarios de políticas/workflow/admin/vendor en verde.
- `scripts/smoke-api.sh` disponible para validación post-deploy.

## Aprobación
- Backend lead: __________________
- Frontend lead: ________________
- QA lead: ______________________
- Fecha/hora: ___________________
