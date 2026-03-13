# Clawbot Integration Workspace

Este directorio concentra la integración de IA del backend con OpenClaw.

Objetivo inicial:
- chat de consultas en modo solo lectura
- traducción de lenguaje natural a herramientas seguras del backend
- respeto de RBAC (`root`, `admin`, `vendedor`, etc.)
- auditoría de cada interacción con `requestId`

Diseño previsto:
- `config.ts`: configuración del runtime OpenClaw
- `types.ts`: contratos internos del chat y herramientas
- `tools/`: herramientas de consulta permitidas
- `prompts/`: prompts de sistema y plantillas
- `service.ts`: orquestación del chat server-side
- `audit.ts`: persistencia de trazabilidad IA

Reglas:
- No usar SQL libre.
- No exponer OpenClaw directamente al frontend.
- Toda consulta debe pasar por el backend proxy.
