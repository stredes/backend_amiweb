# Workflow de Aprobación de Cotizaciones

Sistema completo de gestión de cotizaciones con flujo de aprobación multi-nivel (Vendedor → Admin).

## 📋 Descripción del Flujo

El sistema implementa un workflow completo para el proceso de cotizaciones y órdenes:

```
1. Cliente/Socio → Solicita Cotización
2. Vendedor Asignado → Revisa y Aprueba/Rechaza
3. Admin → Revisa y Aprueba/Rechaza (visto bueno)
4. Sistema → Notifica a Vendedor y Bodega
5. Cliente → Convierte a Orden
6. Bodega → Prepara Pedido
7. Bodega → Despacha Pedido
8. Sistema → Confirma Estados
9. Cliente → Recepciona Pedido
```

## 🔄 Estados de Cotización

### Estados del Flujo
- **`pendiente`**: Solicitud inicial recibida, esperando revisión del vendedor
- **`en_revision_vendedor`**: Vendedor está revisando la solicitud
- **`aprobado_vendedor`**: Vendedor aprobó, esperando aprobación de admin
- **`rechazado_vendedor`**: Vendedor rechazó la solicitud
- **`en_revision_admin`**: Admin está revisando la cotización
- **`aprobado`**: Admin aprobó, cotización lista para convertirse en orden
- **`rechazado`**: Admin rechazó la solicitud
- **`convertida`**: Cotización convertida exitosamente en orden
- **`vencida`**: Cotización expiró sin ser procesada

## 👥 Roles y Permisos

### Cliente / Socio
- Crear solicitudes de cotización
- Ver sus propias cotizaciones
- Convertir cotizaciones aprobadas en órdenes
- Recibir notificaciones de estado

### Vendedor
- Ver cotizaciones asignadas a ellos
- Aprobar/rechazar cotizaciones de sus clientes
- Agregar notas y comentarios
- Ver historial completo

### Admin / Root
- Ver todas las cotizaciones
- Aprobar/rechazar cotizaciones aprobadas por vendedores
- Dar visto bueno final para ventas
- Supervisar todo el proceso

### Bodega
- Recibir notificaciones de nuevas órdenes
- Preparar pedidos confirmados
- Actualizar estados de preparación
- Despachar órdenes preparadas

## 📡 APIs del Sistema

### 1. Crear Cotización
```http
POST /api/quotes
Authorization: Bearer <token> (opcional)

Body:
{
  "customerId": "string (opcional)",
  "customerName": "string",
  "customerEmail": "email",
  "customerPhone": "string",
  "organization": "string",
  "taxId": "string (opcional)",
  "items": [
    {
      "productId": "string",
      "productName": "string",
      "quantity": number
    }
  ],
  "customerMessage": "string (opcional)"
}

Response: 201 Created
{
  "id": "quote_id",
  "quoteNumber": "QUO-2401-1234",
  "assignedSalesRep": "vendor_uid",
  "status": "pendiente",
  ...
}
```

**Lógica**:
- Sistema busca vendedor asignado por `customerId` o `customerEmail`
- Asigna automáticamente el vendedor al quote
- Crea notificación para el vendedor asignado
- Estado inicial: `pendiente`

### 2. Listar Cotizaciones del Vendedor
```http
GET /api/quotes/vendor/pending
Authorization: Bearer <token>
Role: vendedor, admin, root

Response: 200 OK
{
  "quotes": [
    {
      "id": "quote_id",
      "quoteNumber": "QUO-2401-1234",
      "customerName": "Cliente ABC",
      "status": "pendiente",
      ...
    }
  ],
  "total": 5
}
```

**Lógica**:
- Vendedor solo ve sus cotizaciones (`assignedSalesRep == userId`)
- Admin/Root ven todas las cotizaciones pendientes
- Filtra por estados: `pendiente`, `en_revision_vendedor`

### 3. Aprobación por Vendedor
```http
POST /api/quotes/{id}/vendor-approve
Authorization: Bearer <token>
Role: vendedor, admin, root

Body:
{
  "approved": true,
  "notes": "string (opcional)",
  "rejectionReason": "string (si approved=false)"
}

Response: 200 OK
{
  "quote": { ... },
  "message": "Cotización aprobada exitosamente"
}
```

**Lógica Si Aprueba**:
1. Cambia estado a `aprobado_vendedor`
2. Registra `vendorApprovedAt` y `vendorApprovedBy`
3. Notifica a **todos los admins** para revisión
4. Notifica al cliente que su cotización está en revisión

**Lógica Si Rechaza**:
1. Cambia estado a `rechazado_vendedor`
2. Registra `vendorRejectedAt`, razón del rechazo
3. Notifica al cliente del rechazo

### 4. Aprobación por Admin
```http
POST /api/quotes/{id}/admin-approve
Authorization: Bearer <token>
Role: admin, root

Body:
{
  "approved": true,
  "notes": "string (opcional)",
  "rejectionReason": "string (si approved=false)"
}

Response: 200 OK
{
  "quote": { ... },
  "message": "Cotización aprobada exitosamente"
}
```

**Lógica Si Aprueba**:
1. Cambia estado a `aprobado`
2. Registra `adminApprovedAt` y `adminApprovedBy`
3. Notifica al **vendedor** que puede proceder
4. Notifica al **cliente** que su cotización fue aprobada
5. Cotización lista para convertirse en orden

**Lógica Si Rechaza**:
1. Cambia estado a `rechazado`
2. Notifica al vendedor del rechazo
3. Notifica al cliente

### 5. Convertir Cotización a Orden
```http
POST /api/quotes/{id}/convert-to-order
Authorization: Bearer <token>
Role: cliente, socio, vendedor, admin, root

Body:
{
  "paymentMethod": "efectivo|transferencia|tarjeta_credito|tarjeta_debito|cheque",
  "shippingAddress": {
    "street": "string",
    "city": "string",
    "region": "string",
    "postalCode": "string (opcional)",
    "country": "string"
  },
  "shippingMethod": "retiro|despacho_standard|despacho_express",
  "notes": "string (opcional)"
}

Response: 201 Created
{
  "order": {
    "id": "order_id",
    "orderNumber": "ORD-1234567890",
    "status": "pendiente",
    "quoteId": "quote_id",
    "quoteNumber": "QUO-2401-1234",
    ...
  },
  "message": "Orden creada exitosamente"
}
```

**Lógica**:
1. Valida que quote esté en estado `aprobado`
2. Valida que no haya sido convertida antes
3. Crea orden con datos del quote
4. Actualiza quote a estado `convertida`
5. Notifica a:
   - **Vendedor**: orden creada
   - **Admins**: nueva orden
   - **Bodega**: pedido listo para preparar
   - **Cliente**: confirmación de orden

### 6. Notificaciones
```http
GET /api/notifications?unreadOnly=false&limit=50
Authorization: Bearer <token>

Response: 200 OK
{
  "notifications": [
    {
      "id": "notif_id",
      "type": "quote_vendor_approved",
      "title": "Cotización aprobada por vendedor",
      "message": "...",
      "read": false,
      "priority": "high",
      "createdAt": "...",
      ...
    }
  ],
  "total": 10,
  "unreadCount": 3
}
```

```http
PATCH /api/notifications
Body: { "notificationIds": ["id1", "id2"] }
o
Body: { "markAllAsRead": true }
```

```http
DELETE /api/notifications
Elimina todas las notificaciones leídas
```

## 🔔 Sistema de Notificaciones

### Tipos de Notificación

| Tipo | Cuándo | A Quién | Prioridad |
|------|--------|---------|-----------|
| `quote_new` | Cliente crea cotización | Vendedor asignado | High |
| `quote_vendor_approved` | Vendedor aprueba | Admin, Cliente | Normal/High |
| `quote_vendor_rejected` | Vendedor rechaza | Cliente | High |
| `quote_admin_approved` | Admin aprueba | Vendedor, Cliente | High |
| `quote_admin_rejected` | Admin rechaza | Vendedor, Cliente | High |
| `quote_converted` | Quote → Orden | Vendedor | High |
| `order_new` | Orden creada | Admin, Bodega, Cliente | Normal/High |
| `order_confirmed` | Orden confirmada | Cliente, Bodega | Normal |
| `order_preparing` | En preparación | Cliente | Normal |
| `order_ready` | Lista para despacho | Cliente, Vendedor | High |
| `order_dispatched` | Orden despachada | Cliente, Vendedor | High |
| `order_delivered` | Orden entregada | Cliente, Vendedor | Normal |
| `order_cancelled` | Orden cancelada | Todos | High |

## 👤 Modelo de Cliente

Los clientes tienen un **vendedor asignado**:

```typescript
interface Customer {
  id: string;
  userId?: string;
  email: string;
  name: string;
  company?: string;
  
  // Vendedor asignado
  assignedSalesRep: string;
  assignedSalesRepName?: string;
  assignedAt?: Timestamp;
  
  // Información comercial
  creditLimit?: number;
  paymentTerms?: 'contado' | '30dias' | '60dias' | '90dias';
  discount?: number;
  
  status: 'activo' | 'inactivo' | 'suspendido';
  ...
}
```

## 📊 Ejemplo de Flujo Completo

### Paso 1: Cliente Solicita Cotización
```bash
POST /api/quotes
{
  "customerEmail": "cliente@empresa.com",
  "customerName": "Juan Pérez",
  ...
}
```
→ Sistema asigna vendedor automáticamente
→ Estado: `pendiente`
→ Notifica al vendedor asignado

### Paso 2: Vendedor Revisa y Aprueba
```bash
POST /api/quotes/{id}/vendor-approve
{
  "approved": true,
  "notes": "Cliente con buen historial, aprobado"
}
```
→ Estado: `aprobado_vendedor`
→ Notifica a admins
→ Notifica al cliente

### Paso 3: Admin Revisa y Da Visto Bueno
```bash
POST /api/quotes/{id}/admin-approve
{
  "approved": true,
  "notes": "Visto bueno para venta"
}
```
→ Estado: `aprobado`
→ Notifica a vendedor y cliente
→ Cliente puede proceder con orden

### Paso 4: Cliente Convierte a Orden
```bash
POST /api/quotes/{id}/convert-to-order
{
  "paymentMethod": "transferencia",
  "shippingAddress": { ... }
}
```
→ Crea orden nueva
→ Estado quote: `convertida`
→ Estado orden: `pendiente`
→ Notifica a bodega

### Paso 5: Bodega Prepara Pedido
```bash
POST /api/warehouse/prepare/{orderId}
{
  "assignedTo": "bodega_user_id"
}
```
→ Estado: `en_preparacion`
→ Ver [WAREHOUSE_SYSTEM.md](./WAREHOUSE_SYSTEM.md)

### Paso 6: Bodega Despacha
```bash
POST /api/warehouse/dispatch/{orderId}
{
  "carrier": "Chilexpress",
  "trackingNumber": "123456"
}
```
→ Estado orden: `enviado`
→ Estado preparación: `despachado`
→ Notifica al cliente

### Paso 7: Confirmación y Recepción
Cliente confirma recepción o sistema actualiza automáticamente
→ Estado: `entregado`

## 🛡️ Validaciones Importantes

### Aprobación de Vendedor
- Solo puede aprobar quotes en estado `pendiente` o `en_revision_vendedor`
- Vendedor solo puede aprobar sus propios clientes (excepto admin/root)
- Debe especificar razón si rechaza

### Aprobación de Admin
- Solo puede aprobar quotes en estado `aprobado_vendedor` o `en_revision_admin`
- Solo roles admin/root pueden aprobar
- Debe especificar razón si rechaza

### Conversión a Orden
- Quote debe estar en estado `aprobado`
- No puede convertirse dos veces
- Debe tener items y totales calculados
- Requiere dirección de envío y método de pago

## 📂 Archivos del Sistema

### Modelos
- `src/models/customer.ts` - Cliente con vendedor asignado
- `src/models/quote.ts` - Cotización con flujo de aprobación
- `src/models/notification.ts` - Sistema de notificaciones
- `src/models/order.ts` - Orden de compra
- `src/models/orderPreparation.ts` - Preparación en bodega

### Validación
- `src/validation/quoteSchema.ts` - Schemas Zod actualizados

### Utilidades
- `src/utils/notifications.ts` - Funciones para notificaciones

### APIs
- `api/quotes/index.ts` - Crear y listar quotes
- `api/quotes/vendor/pending.ts` - Quotes del vendedor
- `api/quotes/[id]/vendor-approve.ts` - Aprobación vendedor
- `api/quotes/[id]/admin-approve.ts` - Aprobación admin
- `api/quotes/[id]/convert-to-order.ts` - Convertir a orden
- `api/notifications/index.ts` - Gestión de notificaciones

## 🔗 Documentación Relacionada

- [SALES_SYSTEM.md](./SALES_SYSTEM.md) - Sistema completo de ventas
- [WAREHOUSE_SYSTEM.md](./WAREHOUSE_SYSTEM.md) - Sistema de bodega y despacho
- [INVENTORY_API.md](./INVENTORY_API.md) - Gestión de inventario

## 🚀 Próximos Pasos

1. Ejecutar script de usuarios si aún no lo hiciste:
   ```bash
   npm run create-users
   ```

2. Probar el flujo completo desde el frontend

3. (Opcional) Crear datos de prueba:
   - Clientes con vendedores asignados
   - Cotizaciones de ejemplo
   
4. Configurar notificaciones push/email (futuro)

## 💡 Notas Técnicas

- Todas las notificaciones se almacenan en Firestore
- Sistema soporta múltiples vendedores y admins
- Auditoría completa con timestamps
- Validación estricta en cada paso
- Notificaciones en tiempo real vía Firestore listeners
