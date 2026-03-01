# GitHub Pipelines

## Workflows

- `ci.yml`: ejecuta pruebas, type-check y lint en PR/push a `main`.
- `vercel-deploy.yml`: ejecuta `quality-gate` y solo si pasa despliega preview en PR y producción en push a `main`.

## Secrets requeridos

Configurar en GitHub Repository Settings -> Secrets and variables -> Actions:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Notas

- Los deploys usan `vercel pull`, `vercel build` y `vercel deploy --prebuilt`.
- El workflow de preview comenta la URL desplegada en el PR.
