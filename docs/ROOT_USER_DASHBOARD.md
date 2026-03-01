# Dashboard Root - Gestión de Usuarios

## Objetivo
Habilitar una consola para usuario `root` donde pueda crear, listar, editar, activar/desactivar, resetear contraseña y eliminar usuarios con trazabilidad completa.

## Modelo de permisos
- `root`: lectura y mutación completa.
- `admin`: solo lectura del directorio de usuarios y auditoría.
- Otros roles: sin acceso a endpoints de administración.

## Endpoints para Dashboard
- `GET /api/users`
  - Query: `page`, `pageSize`, `role`, `isActive`, `search`
  - Permiso: `root` o `admin`
- `POST /api/users`
  - Body: `email`, `password`, `name`, `role`, `company?`, `phone?`, `department?`
  - Permiso: `root`
- `GET /api/users/:id`
  - Permiso: `root` o `admin`
- `PUT /api/users/:id`
  - Body parcial: `name?`, `email?`, `role?`, `company?`, `phone?`, `department?`
  - Permiso: `root`
- `PATCH /api/users/:id/status`
  - Body: `isActive`
  - Permiso: `root`
- `POST /api/users/:id/reset-password`
  - Body: `password`
  - Permiso: `root`
- `DELETE /api/users/:id`
  - Permiso: `root`
- `GET /api/users/:id/audit`
  - Query: `page`, `pageSize`, `action?`
  - Permiso: `root` o `admin`

## Auditoría
Se registra en colección `auditLogs`:
- `action`
- `entityType` (`user`)
- `entityId`
- `actorId`, `actorEmail`, `actorRole`
- `ip`, `userAgent`
- `metadata`
- `createdAt`, `createdAtIso`

Acciones auditadas:
- `user.created`
- `user.updated`
- `user.deleted`
- `user.status_changed`
- `user.password_reset`

## Reglas de seguridad aplicadas
- Un `root` no puede eliminarse a sí mismo.
- Un `root` no puede remover su propio rol `root`.
- No se permite desactivar usuarios con rol `root`.
- No se registra contraseña en logs ni auditoría.

## Recomendaciones frontend
- Ocultar módulo de usuarios salvo rol `root` (y auditoría para `admin` si aplica).
- Confirmación fuerte para `DELETE`, `status` y `reset-password`.
- Mostrar historial de auditoría en ficha del usuario.
- Refrescar lista tras operaciones de mutación.
