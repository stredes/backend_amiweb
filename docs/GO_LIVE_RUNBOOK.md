# Go-Live Runbook (Backend + Front)

Fecha efectiva del proceso: 2026-03-01.

## 1) Orden obligatorio de despliegue
1. Deploy backend (`main` -> Vercel prod).
2. Ejecutar smoke backend.
3. Publicar changelog de API.
4. Deploy frontend apuntando a URL final backend.
5. Ejecutar smoke e2e front.
6. Monitorear 48h.

## 2) Smoke backend
Usar:

```bash
./scripts/smoke-api.sh https://backend-amiweb.vercel.app
```

Validaciones mínimas:
- `/api/health` y `/api/ready` en 200.
- `/api/v1/health` en 200.
- CORS preflight (`OPTIONS`) responde 204.
- `auth/me` sin token responde 401 `TOKEN_MISSING`.
- Endpoints admin/vendor protegidos (401/403 según corresponda).

## 3) Monitoreo post-release
- Correlacionar incidentes con `x-request-id`.
- Revisar errores 5xx por endpoint crítico (`products`, `auth/me`, `vendor/*`, `admin/*`).
- Validar generación de notificaciones en transiciones de cotización/pedido.

## 4) Rollback
1. Reasignar alias productivo al deployment estable anterior en Vercel.
2. Verificar smoke mínimo (health, auth/me, products).
3. Congelar deploys frontend hasta backend estable.
4. Registrar incidente + requestIds impactados.

## 5) Criterio de éxito
- 48h sin incidentes críticos de autenticación, CORS, flujos comerciales o pedidos.
