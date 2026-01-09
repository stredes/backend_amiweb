# Sistema de Ventas - Backend AMIWEB

Documentación completa del sistema de ventas implementado en el backend de AMIWEB.

## 📋 Tabla de Contenidos

- [Arquitectura General](#arquitectura-general)
- [Modelos de Datos](#modelos-de-datos)
- [APIs Implementadas](#apis-implementadas)
- [Flujo de Ventas](#flujo-de-ventas)
- [Ejemplos de Uso](#ejemplos-de-uso)

---

## 🏗️ Arquitectura General

El sistema de ventas consta de tres componentes principales:

1. **Carrito de Compras** (`cart`) - Gestión temporal de productos antes de la compra
2. **Cotizaciones** (`quotes`) - Solicitudes de presupuesto y negociación
3. **Órdenes** (`orders`) - Pedidos confirmados y su seguimiento

```
Cliente → Carrito → Cotización (opcional) → Orden → Entrega
```

---

## 📊 Modelos de Datos

### Order (Orden de Compra)

**Colección Firestore:** `orders`

```typescript
interface Order {
  orderNumber: string;           // Ej: "ORD-2601-0123"
  userId?: string;
  
  // Cliente
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  organization: string;
  taxId?: string;                // RUC/CUIT
  
  // Items
  items: OrderItem[];
  
  // Totales
  subtotal: number;
  discount: number;
  tax: number;
  shippingCost: number;
  total: number;
  
  // Estado
  status: 'pendiente' | 'confirmado' | 'procesando' | 'enviado' | 'entregado' | 'cancelado';
  paymentStatus: 'pendiente' | 'parcial' | 'pagado' | 'reembolsado';
  paymentMethod?: 'transferencia' | 'efectivo' | 'cheque' | 'tarjeta' | 'credito_30' | 'credito_60' | 'credito_90';
  
  // Envío
  shippingAddress: ShippingAddress;
  trackingNumber?: string;
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  confirmedAt?: Timestamp;
  shippedAt?: Timestamp;
  deliveredAt?: Timestamp;
  cancelledAt?: Timestamp;
}
```

**Estados de Orden:**
- `pendiente` - Orden creada, esperando confirmación
- `confirmado` - Confirmada por el vendedor
- `procesando` - En preparación
- `enviado` - Enviado al cliente
- `entregado` - Entregado al cliente
- `cancelado` - Cancelado

### Quote (Cotización)

**Colección Firestore:** `quotes`

```typescript
interface Quote {
  quoteNumber: string;           // Ej: "QUO-2601-0123"
  userId?: string;
  
  // Cliente
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  organization: string;
  
  // Items
  items: QuoteItem[];
  
  // Totales (completados después de generar cotización)
  subtotal?: number;
  discount?: number;
  tax?: number;
  total?: number;
  
  // Estado
  status: 'pendiente' | 'en_proceso' | 'enviada' | 'aceptada' | 'rechazada' | 'vencida' | 'convertida';
  
  // Validez
  validUntil?: Timestamp;
  
  // Relaciones
  orderId?: string;              // Si fue convertida en orden
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  sentAt?: Timestamp;
  acceptedAt?: Timestamp;
  rejectedAt?: Timestamp;
}
```

**Estados de Cotización:**
- `pendiente` - Solicitud recibida
- `en_proceso` - Preparando cotización
- `enviada` - Cotización enviada al cliente
- `aceptada` - Cliente aceptó la cotización
- `rechazada` - Cliente rechazó la cotización
- `vencida` - Cotización venció
- `convertida` - Convertida en orden

### Cart (Carrito)

**Colección Firestore:** `carts`

```typescript
interface Cart {
  userId?: string;               // Si está autenticado
  sessionId?: string;            // Para usuarios anónimos
  
  items: CartItem[];
  
  // Totales
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt?: Timestamp;         // Para carritos de sesión
}
```

---

## 🔌 APIs Implementadas

### 1. API de Órdenes

#### `POST /api/orders`
Crear una nueva orden de compra.

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "customerName": "Juan Pérez",
  "customerEmail": "juan@empresa.com",
  "customerPhone": "+595981234567",
  "organization": "Laboratorio Central",
  "taxId": "80012345-6",
  "items": [
    {
      "productId": "prod-123",
      "productName": "Test Rápido COVID-19",
      "quantity": 10,
      "unitPrice": 50000,
      "subtotal": 500000
    }
  ],
  "subtotal": 500000,
  "discount": 0,
  "tax": 50000,
  "shippingCost": 0,
  "total": 550000,
  "paymentMethod": "transferencia",
  "shippingAddress": {
    "street": "Av. España 1234",
    "city": "Asunción",
    "state": "Central",
    "zipCode": "1234",
    "country": "Paraguay",
    "phone": "+595981234567",
    "contactName": "Juan Pérez"
  },
  "customerNotes": "Entregar en horario de oficina"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "order-doc-id",
    "orderNumber": "ORD-2601-0123",
    "status": "pendiente",
    "paymentStatus": "pendiente",
    ...
  }
}
```

#### `GET /api/orders`
Listar órdenes con filtros.

**Query params:**
- `status` - Filtrar por estado
- `paymentStatus` - Filtrar por estado de pago
- `customerEmail` - Filtrar por email del cliente
- `orderNumber` - Buscar por número de orden
- `page` - Página (default: 1)
- `pageSize` - Items por página (default: 20)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 42,
    "page": 1,
    "pageSize": 20
  }
}
```

#### `GET /api/orders/[id]`
Obtener detalles de una orden específica.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "order-doc-id",
    "orderNumber": "ORD-2601-0123",
    ...
  }
}
```

#### `PATCH /api/orders/[id]`
Actualizar una orden (estado, pago, tracking).

**Body:**
```json
{
  "status": "enviado",
  "trackingNumber": "TRACK-12345",
  "paymentStatus": "pagado"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": { ... }
}
```

#### `DELETE /api/orders/[id]`
Cancelar una orden.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "message": "Orden cancelada exitosamente"
  }
}
```

---

### 2. API de Cotizaciones

#### `POST /api/quotes`
Solicitar una cotización.

**Body:**
```json
{
  "customerName": "María González",
  "customerEmail": "maria@lab.com",
  "customerPhone": "+595981234567",
  "organization": "Lab Diagnóstico",
  "items": [
    {
      "productId": "prod-456",
      "productName": "Reactivo Hemograma",
      "quantity": 5
    }
  ],
  "customerMessage": "Necesito presupuesto urgente"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "quote-doc-id",
    "quoteNumber": "QUO-2601-0045",
    "status": "pendiente",
    ...
  }
}
```

#### `GET /api/quotes`
Listar cotizaciones con filtros.

**Query params:**
- `status` - Filtrar por estado
- `customerEmail` - Filtrar por email
- `quoteNumber` - Buscar por número
- `page`, `pageSize`

#### `GET /api/quotes/[id]`
Obtener detalles de una cotización.

#### `PATCH /api/quotes/[id]`
Actualizar cotización (por vendedor).

**Body:**
```json
{
  "items": [
    {
      "productId": "prod-456",
      "productName": "Reactivo Hemograma",
      "quantity": 5,
      "unitPrice": 120000,
      "subtotal": 600000
    }
  ],
  "subtotal": 600000,
  "tax": 60000,
  "total": 660000,
  "status": "enviada",
  "validDays": 15,
  "quoteNotes": "Precio especial por volumen"
}
```

#### `PUT /api/quotes/[id]`
Cambiar estado (aceptar/rechazar por cliente).

**Body:**
```json
{
  "status": "aceptada"
}
```

---

### 3. API de Carrito

#### `GET /api/cart`
Obtener carrito actual.

**Headers requeridos:**
```
x-user-id: user-123
# O
x-session-id: session-abc
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "cart-doc-id",
    "items": [...],
    "subtotal": 500000,
    "tax": 50000,
    "total": 550000
  }
}
```

#### `POST /api/cart`
Agregar producto al carrito.

**Headers:**
```
x-user-id: user-123
```

**Body:**
```json
{
  "productId": "prod-789",
  "quantity": 2
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "cart-doc-id",
    "items": [...],
    "total": 550000
  }
}
```

#### `PUT /api/cart`
Actualizar todo el carrito.

**Body:**
```json
{
  "items": [
    { "productId": "prod-123", "quantity": 3 },
    { "productId": "prod-456", "quantity": 1 }
  ]
}
```

#### `DELETE /api/cart`
Vaciar carrito.

#### `PATCH /api/cart/items/[productId]`
Actualizar cantidad de un item.

**Body:**
```json
{
  "quantity": 5
}
```

#### `DELETE /api/cart/items/[productId]`
Eliminar un item del carrito.

---

## 🔄 Flujo de Ventas

### Flujo 1: Compra Directa

```
1. Cliente agrega productos al carrito
   POST /api/cart { productId, quantity }

2. Cliente revisa carrito
   GET /api/cart

3. Cliente crea orden
   POST /api/orders { ...datos, items del carrito }

4. Sistema crea orden con estado "pendiente"

5. Vendedor confirma orden
   PATCH /api/orders/[id] { status: "confirmado" }

6. Sistema procesa y envía
   PATCH /api/orders/[id] { status: "enviado", trackingNumber }

7. Cliente recibe producto
   PATCH /api/orders/[id] { status: "entregado" }
```

### Flujo 2: Con Cotización

```
1. Cliente solicita cotización
   POST /api/quotes { customerInfo, items }

2. Vendedor prepara cotización con precios
   PATCH /api/quotes/[id] { items con precios, total, validDays }

3. Vendedor envía cotización
   PATCH /api/quotes/[id] { status: "enviada" }

4. Cliente acepta cotización
   PUT /api/quotes/[id] { status: "aceptada" }

5. Vendedor convierte cotización en orden
   POST /api/orders { ...datos de cotización }
   PATCH /api/quotes/[id] { status: "convertida", orderId }

6. Continúa flujo normal de orden...
```

---

## 💡 Ejemplos de Uso

### Ejemplo 1: Cliente Navegando

```javascript
// 1. Agregar al carrito
const addToCart = async (productId, quantity) => {
  const response = await fetch('/api/cart', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': getSessionId()
    },
    body: JSON.stringify({ productId, quantity })
  });
  return response.json();
};

// 2. Ver carrito
const getCart = async () => {
  const response = await fetch('/api/cart', {
    headers: {
      'x-session-id': getSessionId()
    }
  });
  return response.json();
};

// 3. Crear orden
const createOrder = async (orderData) => {
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(orderData)
  });
  return response.json();
};
```

### Ejemplo 2: Panel de Administración

```javascript
// Listar órdenes pendientes
const getPendingOrders = async () => {
  const response = await fetch('/api/orders?status=pendiente&pageSize=50');
  return response.json();
};

// Confirmar orden
const confirmOrder = async (orderId) => {
  const response = await fetch(`/api/orders/${orderId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status: 'confirmado',
      internalNotes: 'Stock verificado'
    })
  });
  return response.json();
};

// Procesar envío
const shipOrder = async (orderId, trackingNumber) => {
  const response = await fetch(`/api/orders/${orderId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      status: 'enviado',
      trackingNumber
    })
  });
  return response.json();
};
```

---

## 🔧 Inicialización

Para inicializar las colecciones de Firestore:

```bash
npm run init-sales
```

Este script:
- Crea las colecciones `orders`, `quotes`, y `carts`
- Inserta documentos de ejemplo
- Muestra los índices recomendados

---

## 📝 Notas Importantes

### Seguridad

- Los endpoints de administración (PATCH de órdenes y cotizaciones) deben protegerse con autenticación
- Implementar validación de permisos según roles de usuario
- Los clientes solo deben poder ver sus propias órdenes/cotizaciones

### Índices de Firestore

Crear estos índices compuestos en Firestore:

**orders:**
- `status` + `createdAt` (DESC)
- `paymentStatus` + `createdAt` (DESC)
- `customerEmail` + `createdAt` (DESC)

**quotes:**
- `status` + `createdAt` (DESC)
- `customerEmail` + `createdAt` (DESC)

**carts:**
- `userId` (ASC)
- `sessionId` (ASC)

### TODOs Pendientes

- [ ] Implementar notificaciones por email
- [ ] Integrar con pasarela de pagos
- [ ] Agregar webhooks para actualizaciones
- [ ] Sistema de descuentos y cupones
- [ ] Cálculo dinámico de impuestos según región
- [ ] Integración con sistema de inventario
- [ ] Reportes y analíticas de ventas

---

## 📞 Contacto

Para dudas o problemas con el sistema de ventas, contactar al equipo de desarrollo.
