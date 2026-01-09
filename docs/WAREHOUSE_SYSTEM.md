# Sistema de Bodega - Backend AMIWEB

Documentación completa del sistema de gestión de bodega para preparación y despacho de pedidos.

## 📋 Tabla de Contenidos

- [Arquitectura](#arquitectura)
- [Modelos de Datos](#modelos-de-datos)
- [Sistema de Roles y Permisos](#sistema-de-roles-y-permisos)
- [APIs de Bodega](#apis-de-bodega)
- [Flujo de Trabajo](#flujo-de-trabajo)
- [Ejemplos de Uso](#ejemplos-de-uso)

---

## 🏗️ Arquitectura

El sistema de bodega gestiona la preparación y despacho de pedidos confirmados, con las siguientes funcionalidades:

1. **Listado de Pedidos** - Ver todos los pedidos pendientes de preparación
2. **Asignación** - Asignar pedidos a preparadores específicos
3. **Preparación** - Tracking de progreso de preparación item por item
4. **Despacho** - Registrar despacho con transportista y tracking

```
Orden Confirmada → Asignación → Preparación → Despacho → En Tránsito
```

---

## 📊 Modelos de Datos

### OrderPreparation (Preparación de Pedido)

**Colección Firestore:** `orderPreparations`

```typescript
interface OrderPreparation {
  orderId: string;
  orderNumber: string;
  
  // Estado de preparación
  status: 'pendiente' | 'asignado' | 'en_preparacion' | 'preparado' | 'despachado';
  
  // Asignación
  assignedTo?: string;         // UID del preparador
  assignedToName?: string;
  assignedAt?: Timestamp;
  
  // Progreso
  items: OrderPreparationItem[];
  totalItems: number;
  preparedItems: number;
  progress: number;             // 0-100%
  
  // Tiempos
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  
  // Despacho
  dispatchedBy?: string;
  dispatchedByName?: string;
  dispatchedAt?: Timestamp;
  carrier?: string;             // Transportista
  trackingNumber?: string;
  
  // Notas
  preparationNotes?: string;
  dispatchNotes?: string;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### OrderPreparationItem

```typescript
interface OrderPreparationItem {
  productId: string;
  productName: string;
  quantityOrdered: number;
  quantityPrepared: number;
  notes?: string;
  isPrepared: boolean;
}
```

**Estados de Preparación:**
- `pendiente` - Pendiente de asignar
- `asignado` - Asignado a un preparador
- `en_preparacion` - En proceso de preparación
- `preparado` - Preparado, listo para despacho
- `despachado` - Despachado

---

## 🔐 Sistema de Roles y Permisos

### Roles Disponibles

**Ubicación:** [src/models/user.ts](src/models/user.ts)

```typescript
type UserRole = 
  | 'root'      // Super administrador
  | 'admin'     // Administrador general
  | 'vendedor'  // Vendedor / Ejecutivo comercial
  | 'bodega'    // Personal de bodega
  | 'socio'     // Socio / Cliente premium
  | 'cliente';  // Cliente regular
```

### Permisos del Rol "Bodega"

```typescript
bodega: [
  'orders.read',       // Ver órdenes
  'orders.prepare',    // Preparar pedidos
  'orders.ship',       // Despachar pedidos
  'products.read',     // Ver productos
  'inventory.read',    // Ver inventario
  'inventory.write'    // Modificar inventario
]
```

### Middleware de Autorización

**Ubicación:** [src/middleware/auth.ts](src/middleware/auth.ts)

```typescript
// Verificar rol específico
requireRole(req, res, ['bodega', 'admin'])

// Verificar permisos de bodega
requireWarehouse(req, res)

// Verificar permiso específico
requirePermission(req, res, 'orders.prepare')
```

---

## 🔌 APIs de Bodega

### 1. Listar Pedidos para Bodega

#### `GET /api/warehouse/orders`

Lista todos los pedidos confirmados que requieren preparación.

**Headers:**
```
Authorization: Bearer <token>
```

**Query params:**
- `status` - Filtrar por estado de preparación (pendiente, asignado, en_preparacion, preparado)
- `assignedTo` - Filtrar por UID de preparador asignado

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "order-id",
        "orderNumber": "ORD-2601-0123",
        "customerName": "Juan Pérez",
        "items": [...],
        "total": 550000,
        "status": "confirmado",
        "preparation": {
          "status": "asignado",
          "assignedTo": "user-uid",
          "progress": 45,
          "preparedItems": 3,
          "totalItems": 7
        }
      }
    ],
    "total": 12
  }
}
```

---

### 2. Detalles de Preparación

#### `GET /api/warehouse/prepare/[orderId]`

Obtiene los detalles completos de preparación de un pedido.

**Headers:**
```
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "order": {
      "id": "order-id",
      "orderNumber": "ORD-2601-0123",
      ...
    },
    "preparation": {
      "orderId": "order-id",
      "status": "en_preparacion",
      "assignedTo": "user-uid",
      "assignedToName": "bodega1@amilab.com",
      "items": [
        {
          "productId": "prod-123",
          "productName": "Test Rápido COVID-19",
          "quantityOrdered": 10,
          "quantityPrepared": 10,
          "isPrepared": true
        }
      ],
      "progress": 45,
      "preparedItems": 3,
      "totalItems": 7,
      "startedAt": "2026-01-09T...",
      "updatedAt": "2026-01-09T..."
    }
  }
}
```

---

### 3. Asignar Preparador

#### `POST /api/warehouse/prepare/[orderId]`

Asigna el pedido al usuario autenticado y crea el registro de preparación.

**Headers:**
```
Authorization: Bearer <token>
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "order-id",
    "orderId": "order-id",
    "orderNumber": "ORD-2601-0123",
    "status": "asignado",
    "assignedTo": "user-uid",
    "assignedToName": "bodega1@amilab.com",
    "assignedAt": "2026-01-09T...",
    "items": [...],
    "totalItems": 7,
    "preparedItems": 0,
    "progress": 0
  }
}
```

**Validaciones:**
- Orden debe estar en estado `confirmado` o `procesando`
- Orden no puede tener preparador asignado previamente

---

### 4. Actualizar Progreso de Preparación

#### `PATCH /api/warehouse/prepare/[orderId]`

Actualiza el progreso de preparación marcando items como preparados.

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "items": [
    {
      "productId": "prod-123",
      "productName": "Test Rápido COVID-19",
      "quantityOrdered": 10,
      "quantityPrepared": 10,
      "isPrepared": true,
      "notes": "Verificado stock y empacado"
    },
    {
      "productId": "prod-456",
      "productName": "Reactivo Hemograma",
      "quantityOrdered": 5,
      "quantityPrepared": 3,
      "isPrepared": false
    }
  ],
  "notes": "Preparación en progreso"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "order-id",
    "status": "en_preparacion",
    "progress": 60,
    "preparedItems": 4,
    "totalItems": 7,
    "items": [...],
    "preparationNotes": "Preparación en progreso"
  }
}
```

**Lógica automática:**
- Si es la primera actualización: cambio de `asignado` a `en_preparacion` y marca `startedAt`
- Si todos los items están preparados: cambio a `preparado` y marca `completedAt`

---

### 5. Despachar Pedido

#### `POST /api/warehouse/dispatch/[orderId]`

Marca el pedido como despachado y actualiza la orden principal.

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "carrier": "Chilexpress",
  "trackingNumber": "TRACK-12345678",
  "notes": "Paquete entregado a transportista"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "preparation": {
      "id": "order-id",
      "status": "despachado",
      "dispatchedBy": "user-uid",
      "dispatchedByName": "bodega1@amilab.com",
      "dispatchedAt": "2026-01-09T...",
      "carrier": "Chilexpress",
      "trackingNumber": "TRACK-12345678"
    },
    "order": {
      "id": "order-id",
      "status": "enviado",
      "trackingNumber": "TRACK-12345678",
      "shippedAt": "2026-01-09T..."
    }
  }
}
```

**Validaciones:**
- Pedido debe tener registro de preparación
- Estado de preparación debe ser `preparado`
- Actualiza orden principal a estado `enviado`

---

### 6. Estadísticas de Bodega

#### `GET /api/warehouse/stats`

Obtiene estadísticas para el dashboard de bodega.

**Headers:**
```
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "ordersToday": 0,
    "ordersPending": 8,
    "ordersInProgress": 3,
    "ordersCompleted": 15,
    "averagePreparationTime": 45
  }
}
```

**Métricas:**
- `ordersToday` - Órdenes recibidas hoy
- `ordersPending` - Órdenes pendientes (confirmadas)
- `ordersInProgress` - Órdenes en preparación
- `ordersCompleted` - Órdenes despachadas
- `averagePreparationTime` - Tiempo promedio de preparación en minutos

---

## 🔄 Flujo de Trabajo Completo

### Para Personal de Bodega:

```
1. VER PEDIDOS PENDIENTES
   GET /api/warehouse/orders?status=pendiente
   
2. ASIGNAR PEDIDO A MÍ MISMO
   POST /api/warehouse/prepare/[orderId]
   → Estado: asignado
   → Orden: procesando
   
3. INICIAR PREPARACIÓN
   GET /api/warehouse/prepare/[orderId]
   → Ver lista de items a preparar
   
4. MARCAR ITEMS COMO PREPARADOS
   PATCH /api/warehouse/prepare/[orderId]
   {
     items: [
       { productId: "...", quantityPrepared: 10, isPrepared: true }
     ]
   }
   → Primera actualización: en_preparacion
   → Todos completados: preparado
   
5. DESPACHAR PEDIDO
   POST /api/warehouse/dispatch/[orderId]
   {
     carrier: "Chilexpress",
     trackingNumber: "TRACK-123"
   }
   → Estado preparación: despachado
   → Estado orden: enviado
```

### Estados del Flujo:

```
confirmado (orden)
    ↓
asignado (preparación)
    ↓
en_preparacion (preparación)
    ↓
preparado (preparación)
    ↓
despachado (preparación) + enviado (orden)
```

---

## 💡 Ejemplos de Uso

### Ejemplo 1: Dashboard de Bodega

```javascript
// Ver pedidos pendientes
const getPendingOrders = async () => {
  const response = await fetch('/api/warehouse/orders?status=pendiente', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};

// Ver mis pedidos asignados
const getMyOrders = async (userId) => {
  const response = await fetch(`/api/warehouse/orders?assignedTo=${userId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};
```

### Ejemplo 2: Preparar Pedido

```javascript
// Tomar pedido
const assignOrder = async (orderId) => {
  const response = await fetch(`/api/warehouse/prepare/${orderId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};

// Actualizar progreso
const updatePreparation = async (orderId, items) => {
  const response = await fetch(`/api/warehouse/prepare/${orderId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ items })
  });
  return response.json();
};
```

### Ejemplo 3: Despachar

```javascript
const dispatchOrder = async (orderId, dispatchData) => {
  const response = await fetch(`/api/warehouse/dispatch/${orderId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(dispatchData)
  });
  return response.json();
};

// Uso
await dispatchOrder('order-123', {
  carrier: 'Chilexpress',
  trackingNumber: 'TRACK-12345678',
  notes: 'Paquete en camino'
});
```

---

## 🚀 Crear Usuarios de Bodega

Para crear usuarios con rol de bodega:

```bash
npm run create-users
```

**Usuarios de bodega predefinidos:**
- `bodega1@amilab.com` / `bodega123`
- `bodega2@amilab.com` / `bodega123`

---

## 📝 Notas de Implementación

### Seguridad

- ✅ Todos los endpoints requieren autenticación
- ✅ Verificación de rol `bodega` o `admin`
- ✅ Logs de auditoría en todas las operaciones
- ✅ Validación de estados antes de transiciones

### Integraciones Futuras

- [ ] Notificaciones push cuando se asigna un pedido
- [ ] Escaneo de códigos de barras para verificación
- [ ] Integración con impresoras de etiquetas
- [ ] Firma digital de recepción
- [ ] Fotos de evidencia de empaque
- [ ] Integración con APIs de transportistas

### Índices de Firestore Recomendados

**orderPreparations:**
- `status` + `createdAt` (DESC)
- `assignedTo` + `status` + `createdAt` (DESC)

---

## 📞 Contacto

Para dudas sobre el sistema de bodega, contactar al equipo de desarrollo.

---

*Última actualización: Enero 2026*
