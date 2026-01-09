# 🚀 Configuración de Variables de Entorno en Vercel

## ⚠️ ACCIÓN REQUERIDA

El backend se está desplegando pero necesita las variables de entorno de Firebase configuradas en Vercel.

---

## 📋 Variables a Configurar:

Ve a: https://vercel.com/gianlucassanmartin-gmailcoms-projects/backend-amiweb/settings/environment-variables

Agrega estas 3 variables:

### 1. FIREBASE_PROJECT_ID
```
amiweb-895d7
```

### 2. FIREBASE_CLIENT_EMAIL
```
firebase-adminsdk-fbsvc@amiweb-895d7.iam.gserviceaccount.com
```

### 3. FIREBASE_PRIVATE_KEY
```
-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDqJ6S+zcJW7GET
ANxrH22ZInjkX6XwG5mWTMp6trPCGI7BuHwCTiN+H7n7O8KPOyo8EGEb5jG8ntRt
sPuUACFQQF+2sxGJ14W6wtmh0PjbGASGMKQuYkJeM8SJRJNtD6hSoFdGp04x7Ira
2R0+UHVf9pbypE4K9hsCPL1wm+gLWensQPW43JlMrXNf0IYfgyNBD8PQ5gLbSWfc
JbX/tJmk+zfq6Ks6bSPVGMeotYcROsYvuYppGpuEpBZ/z0ZIQb2VE4E1n5FgmPxX
i46OoRKTNbD32WgcY3aMCQIJcEEahfWTvkkgMf0n0m/bc73KBCNpa7KGErCWOYIG
VQiOdusnAgMBAAECggEAQTP33r/6OW1KXNnVBylxwf5E7scptJJi8uUATyqYJNjk
y9H9CkFLBeB80BZkh7EAgkhHWlcAC5eo7MCnVZ+xpyC95mi33gv7a7W9l59S5OOr
wthBp77p30SIGndTnD+LbjLDCuQk1KcbRXTG/Wa3QJkwkHGrX8cHX1idogFwHNSN
AHSqtjT4bvNZqqRCCiEVq8As5kWLaC43o9T4zK+2YP12T5O2OsvLPDcrR7tjkLLw
WE7E3uDIXm0UnEfmL9S6onzZ+uuiyF4ZT7AKs3en5kkSNEnmhGu0hvU36HA0bhrl
j7i12iifqYCdkU0Zah43Zy65OXDt97mUqx3215ibKQKBgQD22dtln4J23jPeqiy6
FS3ZBqghUGM3lnQPyg6maktcLxwSuMNEyR9tzVK8y2EAu9o79pFr0c1Lv2kGZ9cv
ZqRRAERBuxYQZHpcBUpLWQMEwAZqDazw9ON9CHCxpwKD4dNzYYH+K9cntOMQnK4P
kwx6vBejTVw5W++NOsBXFTqPiQKBgQDy1VMNBnRAlA7yc0aESjMtXHzLJ75wCTpD
LPOjjbBKNXcgBOKYdy5NawWBEjEF9P/KKlsWQac56Yc/SsN4vGLqLQ2jEKkrMN2i
DoYa/d2xYfeER/8+GxbWUOi+geQy1w8x3xpi+M8ZOrxhTStbnbgVrm2B1U1/Q3D7
puykGOTJLwKBgQDN8iJmHXdGXsodqhKYyVSv7SrWaG/uj5qTFbu1QZdP+InOYNGh
EL8k55lwo6lxaEiBoIvgzXAfEzm3O2k/Rb4vSi6oPEMDOCERpuQ+CqxHCUIQtwoj
Gdy1kxYaUUD68KxuZdqDSOY/XV3XnTBnFALkXwrFlqQrwrUQOgUAYliyKQKBgQDU
IKo2PKcdKrmL7ktxkOf3/k09ovBnKohs2j3TaBjSGrZ/kATqL2KRWqYqRFvy2j0A
u9NqM9wDaQ8uqP7s35SBAO5ivlEpW7ygrpNTzOT26Z+xPLup4zwl5/QJR6qzBs9N
P5nrT3KKlZauYR05ISQIPKGIw265d46hJwadqulhHQKBgDOAlG+3vpNXRqJTuuAO
vtiminh0wHuPtT+r1NjlA4Sxcd6c2EJNCx4CBZBWv8t3HRyphmKOWcfWNtTTuHrN
gTtadd4uNlairv1QxWRAM2YSeL4lzFvWYYw6miOzjOXSzDw33i3lzsmMzrG636zQ
JlfGsfc/83/cnvS2BQHAKerR
-----END PRIVATE KEY-----
```

⚠️ **IMPORTANTE:** Para FIREBASE_PRIVATE_KEY, copia el valor completo **incluyendo** las líneas de BEGIN y END.

---

## 🔧 Pasos:

1. Ve a la configuración del proyecto en Vercel
2. Pestaña "Settings" → "Environment Variables"
3. Agrega cada variable (Name y Value)
4. **Aplica a todos los entornos** (Production, Preview, Development)
5. Haz clic en "Save"
6. **Redeploy** el proyecto para que tome las variables

---

## 🔗 Enlaces Directos:

**Project Settings:** https://vercel.com/gianlucassanmartin-gmailcoms-projects/backend-amiweb/settings

**Environment Variables:** https://vercel.com/gianlucassanmartin-gmailcoms-projects/backend-amiweb/settings/environment-variables

**Deployments:** https://vercel.com/gianlucassanmartin-gmailcoms-projects/backend-amiweb

---

## ✅ Después de Configurar:

El backend funcionará correctamente en:
```
https://backend-amiweb-58buz6a20-gianlucassanmartin-gmailcoms-projects.vercel.app/api/inventory/upload
```

Y el frontend podrá cargar inventarios sin modo mock.
