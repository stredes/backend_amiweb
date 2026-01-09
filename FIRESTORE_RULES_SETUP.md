# 🔒 Configuración de Reglas de Firestore

## 📋 Problema
Las reglas de Firestore actuales no permiten lectura pública de productos, lo que impide que el frontend cargue el catálogo sin autenticación.

## ✅ Solución

### Paso 1: Abre Firebase Console
🔗 [https://console.firebase.google.com/](https://console.firebase.google.com/)

### Paso 2: Navega a las Reglas
1. Selecciona tu proyecto: **amiweb-895d7**
2. En el menú lateral, haz clic en **"Firestore Database"**
3. Haz clic en la pestaña **"Reglas"** (Rules)

### Paso 3: Copia las Reglas
1. Abre el archivo `firestore.rules` en este proyecto
2. **Selecciona todo el contenido** (Ctrl+A / Cmd+A)
3. **Copia** (Ctrl+C / Cmd+C)

### Paso 4: Pega en Firebase Console
1. **Selecciona todo** el contenido actual en el editor de Firebase Console
2. **Pega** las nuevas reglas (Ctrl+V / Cmd+V)
3. Haz clic en **"Publicar"** (Publish)

### Paso 5: Espera la Confirmación
- Deberías ver un mensaje de éxito ✅
- Las reglas pueden tardar unos segundos en aplicarse

## 🎯 Reglas Clave Aplicadas

### ✅ Lectura Pública (Sin Autenticación)
```javascript
// Productos - Cualquiera puede ver
match /products/{productId} {
  allow read: if true;
}

// Categorías - Cualquiera puede ver
match /categories/{categoryId} {
  allow read: if true;
}

// Metadata del sitio - Cualquiera puede ver
match /metadata/{docId} {
  allow read: if true;
}
```

### 🔒 Escritura Protegida (Solo Admin)
```javascript
// Solo usuarios con rol 'admin' o 'root' pueden crear/modificar
allow create, update, delete: if isAdmin();
```

### 📝 Mensajes de Contacto (Crear Público, Leer Admin)
```javascript
match /contactMessages/{messageId} {
  allow create: if true;          // Cualquiera puede enviar
  allow read: if isAdmin();        // Solo admin puede leer
}
```

## 🧪 Verificación

Después de publicar las reglas:

1. **Recarga el frontend** (F5 o Ctrl+R)
2. El cuadro de debug debería mostrar:
   ```
   ✅ Conexión exitosa! X productos obtenidos
   ```
3. Los **846 productos** deberían cargarse en el catálogo

## 🔍 Troubleshooting

### Error: "Missing or insufficient permissions"
- Verifica que publicaste las reglas correctamente
- Espera 10-30 segundos para propagación
- Refresca el frontend

### Error: "PERMISSION_DENIED"
- Las reglas antiguas siguen activas
- Verifica en Firebase Console que las nuevas reglas están publicadas
- Revisa la pestaña "Reglas" para confirmar el contenido

### Frontend no carga productos
1. Abre la consola del navegador (F12)
2. Busca errores de Firestore
3. Verifica que el backend esté conectado (puerto 3000)

## 📚 Documentación Relacionada
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Testing Rules](https://firebase.google.com/docs/firestore/security/test-rules-emulator)

---

**Última actualización:** 8 de enero de 2026
