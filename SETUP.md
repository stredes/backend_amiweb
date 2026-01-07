# Configuración Rápida

## Instalación

```bash
npm install
```

## Variables de Entorno

1. Copia el archivo de ejemplo:
```bash
cp .env.example .env
```

2. Configura las variables en `.env` con tus credenciales de Firebase:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY` (mantén los `\n` para saltos de línea)

## Desarrollo Local

```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

## Verificar TypeScript

```bash
npm run type-check
```

## Deploy a Vercel

```bash
npx vercel
```

O conecta el repositorio en vercel.com y configura las variables de entorno en el dashboard.

## Mejoras Implementadas

✅ **Middleware de Autenticación** - Protección con Firebase Auth  
✅ **CORS Configurado** - Permite requests del frontend  
✅ **Búsqueda Optimizada** - Campo searchKeywords para productos  
✅ **Validación de Referencias** - Verifica categoryId al crear productos  
✅ **Error Handler Centralizado** - Logs estructurados  
✅ **TypeScript Strict** - Tipado completo y validado  

## Próximos Pasos

- [ ] Configurar Firebase en `.env`
- [ ] Ejecutar `npm run dev` para probar
- [ ] Implementar autenticación en endpoints admin
- [ ] Agregar índices de Firestore para búsquedas
- [ ] Configurar dominios en CORS para producción
