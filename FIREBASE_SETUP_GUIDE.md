# 🔐 Guía de Configuración: Firebase Authentication

## ⚠️ Error Actual

El script automático falló con el error:
```
There is no configuration corresponding to the provided identifier.
```

Esto significa que **Authentication no está habilitado** en Firebase.

---

## ✅ Solución: Configuración Manual en Firebase Console

### Paso 1: Habilitar Firebase Authentication

1. **Ir a Firebase Console:**
   ```
   https://console.firebase.google.com/project/amiweb-895d7/authentication
   ```

2. **Hacer clic en "Get Started" o "Comenzar"** (si aparece)

3. **Ir a la pestaña "Sign-in method"**

4. **Habilitar Email/Password:**
   - Buscar "Email/Password" en la lista de proveedores
   - Hacer clic en el proveedor
   - Activar el toggle "Enable"
   - **NO marcar** "Email link (passwordless sign-in)"
   - Hacer clic en "Save" / "Guardar"

---

### Paso 2: Crear Usuarios Manualmente

Una vez habilitado Email/Password:

1. **Ir a la pestaña "Users"**
   ```
   https://console.firebase.google.com/project/amiweb-895d7/authentication/users
   ```

2. **Hacer clic en "Add user"**

3. **Crear cada usuario con estos datos:**

#### Usuario 1: Root (Super Admin)
```
Email: root@amilab.com
Password: root2026
```

#### Usuario 2: Administrador
```
Email: admin@amilab.com
Password: admin123
```

#### Usuario 3: Vendedor 1
```
Email: vendedor1@amilab.com
Password: vende123
```

#### Usuario 4: Vendedor 2
```
Email: vendedor2@amilab.com
Password: vende123
```

#### Usuario 5: Socio/Cliente
```
Email: socio@amilab.com
Password: demo123
```

---

### Paso 3: Reintentar Script Automático (Opcional)

Una vez habilitado Authentication, puedes ejecutar el script para crear usuarios automáticamente:

```bash
npm run create-users
```

El script:
- ✅ Crea los 5 usuarios automáticamente
- ✅ Establece sus roles (custom claims)
- ✅ Verifica emails automáticamente
- ✅ Actualiza usuarios si ya existen

---

## 📋 Verificación

### 1. Verificar que los usuarios fueron creados:
   - Ve a: https://console.firebase.google.com/project/amiweb-895d7/authentication/users
   - Deberías ver 5 usuarios listados

### 2. Probar login en tu aplicación:
   ```bash
   # En tu frontend
   npm run dev
   ```
   - Ve a: http://localhost:5173/login
   - Intenta login con: `root@amilab.com` / `root2026`

### 3. Verificar token:
   - Abre DevTools → Application → Local Storage
   - Busca la key `authToken`
   - Debería contener un JWT largo (no "mock-token-123456")

---

## 🔧 Troubleshooting

### Error: "Email/Password is not enabled"
**Solución:** Repetir Paso 1 y asegurarse de guardar los cambios

### Error: "Email already exists"
**Solución:** El usuario ya fue creado, esto es normal

### Error: "auth/weak-password"
**Solución:** La contraseña debe tener al menos 6 caracteres

### Error: "auth/invalid-email"
**Solución:** Verificar formato del email

---

## 🎯 Siguiente Paso

1. **Habilitar Authentication en Firebase Console** ⚠️ OBLIGATORIO
2. Crear los 5 usuarios manualmente (o usar el script después)
3. Probar login en la aplicación
4. Verificar que StockUploader pueda subir inventario

---

## 📝 Scripts Disponibles

```bash
# Crear usuarios automáticamente (después de habilitar Auth)
npm run create-users

# Inicializar Firestore con datos de ejemplo
npm run init-firestore

# Iniciar servidor de desarrollo
npm run dev
```

---

## ✅ Checklist de Configuración

- [ ] Ir a Firebase Console
- [ ] Habilitar Authentication (Get Started)
- [ ] Activar Email/Password en Sign-in method
- [ ] Crear 5 usuarios (manual o con script)
- [ ] Verificar usuarios en pestaña Users
- [ ] Probar login en la aplicación
- [ ] Verificar token JWT en localStorage
- [ ] Probar carga de inventario en StockUploader

---

## 🔗 Enlaces Rápidos

- **Firebase Console (Proyecto):** https://console.firebase.google.com/project/amiweb-895d7
- **Authentication:** https://console.firebase.google.com/project/amiweb-895d7/authentication
- **Sign-in Methods:** https://console.firebase.google.com/project/amiweb-895d7/authentication/providers
- **Users:** https://console.firebase.google.com/project/amiweb-895d7/authentication/users
- **Firestore:** https://console.firebase.google.com/project/amiweb-895d7/firestore

---

## 💡 Nota Importante

El script de creación de usuarios **requiere que Authentication esté habilitado primero**. Firebase no permite crear usuarios programáticamente si el servicio no está inicializado en la consola.

Por eso el primer paso debe hacerse manualmente en Firebase Console.
