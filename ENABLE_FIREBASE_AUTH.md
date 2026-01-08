# ⚠️ ACCIÓN REQUERIDA: Habilitar Firebase Authentication

## 🔴 El Script No Puede Ejecutarse Porque:

Firebase Authentication **no está inicializado** en tu proyecto. Este es un paso que **debe hacerse manualmente** en Firebase Console.

---

## ✅ SOLUCIÓN RÁPIDA (5 minutos)

### 1️⃣ Abre Firebase Console
```
https://console.firebase.google.com/project/amiweb-895d7/authentication
```

### 2️⃣ Haz Clic en "Get Started"
- Verás un botón grande azul que dice **"Get Started"** o **"Comenzar"**
- Haz clic en él

### 3️⃣ Habilita Email/Password
- Ve a la pestaña **"Sign-in method"** (segunda pestaña)
- Busca **"Email/Password"** en la lista
- Haz clic en él
- Activa el toggle **"Enable"**
- Haz clic en **"Save"**

### 4️⃣ Ejecuta el Script Nuevamente
```bash
npm run create-users
```

---

## 🎯 Después de Ejecutar

El script creará automáticamente:

✅ **root@amilab.com** (contraseña: root2026) - Rol: root
✅ **admin@amilab.com** (contraseña: admin123) - Rol: admin  
✅ **vendedor1@amilab.com** (contraseña: vende123) - Rol: vendedor
✅ **vendedor2@amilab.com** (contraseña: vende123) - Rol: vendedor
✅ **socio@amilab.com** (contraseña: demo123) - Rol: socio

---

## 🔗 Enlaces Directos

**Authentication:** https://console.firebase.google.com/project/amiweb-895d7/authentication

**Sign-in Methods:** https://console.firebase.google.com/project/amiweb-895d7/authentication/providers

---

## ❓ Por Qué Este Paso Es Manual

Firebase requiere que el administrador del proyecto habilite explícitamente cada método de autenticación en la consola. Esto es una medida de seguridad para evitar que aplicaciones no autorizadas creen usuarios.

Una vez habilitado, el script puede crear usuarios programáticamente.

---

## 📝 Nota sobre serviceAccountKey.json

He creado el archivo `serviceAccountKey.json` con tus credenciales del .env.
Este archivo ya está en .gitignore para que no se suba a git.

El script ahora soporta ambas opciones:
- ✅ serviceAccountKey.json (si existe)
- ✅ Variables de entorno en .env (fallback)
