# API de Carga de Inventario

## Endpoint de Upload

### `POST /api/inventory/upload`

Subir productos masivamente desde el frontend (procesa Excel/CSV en el cliente y envía JSON al backend).

---

## 🔐 Autenticación

**Requerida:** Sí (rol admin)

**Header:**
```
Authorization: Bearer <firebase-id-token>
```

**Cómo obtener el token:**
```javascript
// En el frontend
const user = firebase.auth().currentUser;
const token = await user.getIdToken();
```

---

## 📥 Request

### Headers
```
Content-Type: application/json
Authorization: Bearer <token>
```

### Body (JSON)

```json
{
  "products": [
    {
      "sku": "PROD-001",           // Opcional
      "name": "Microscopio Digital",
      "slug": "microscopio-digital",
      "categoryId": "cat_12345",   // ID de categoría existente
      "brand": "Olympus",
      "shortDescription": "Descripción corta del producto",
      "longDescription": "Descripción detallada del producto con especificaciones...",
      "specs": {
        "Aumento": "40x-1000x",
        "Peso": "2.5 kg"
      },
      "requiresInstallation": false,
      "isActive": true,
      "stock": 10,                 // Opcional
      "price": 250000             // Opcional
    }
  ],
  "overwriteExisting": false      // Si true, actualiza productos existentes con mismo slug
}
```

### Validaciones

- **Máximo 500 productos por batch**
- `name`: mínimo 2 caracteres
- `slug`: mínimo 2 caracteres, único
- `categoryId`: debe existir en la colección `categories`
- `brand`: mínimo 1 carácter
- `stock`: número entero ≥ 0 (opcional)
- `price`: número positivo (opcional)

---

## 📤 Response

### Success (201 Created)

```json
{
  "success": true,
  "data": {
    "totalProcessed": 100,
    "successful": 95,
    "failed": 3,
    "skipped": 2,
    "errors": [
      {
        "index": 5,
        "name": "Producto con error",
        "error": "Product with this slug already exists"
      }
    ],
    "createdIds": [
      "prod_abc123",
      "prod_def456"
    ]
  }
}
```

### Error Responses

**401 Unauthorized**
```json
{
  "success": false,
  "error": "No authorization token provided"
}
```

**403 Forbidden**
```json
{
  "success": false,
  "error": "Admin access required"
}
```

**400 Bad Request**
```json
{
  "success": false,
  "error": "Invalid payload: products must contain at least 1 item"
}
```

---

## 🔄 Flujo Completo

### 1. Frontend: Procesar archivo

```typescript
// Leer Excel/CSV con una librería como SheetJS
import * as XLSX from 'xlsx';

function parseExcelFile(file: File): Promise<Product[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);
      
      // Mapear a formato de API
      const products = jsonData.map((row: any) => ({
        name: row['Nombre'] || row['name'],
        slug: generateSlug(row['Nombre'] || row['name']),
        categoryId: row['Categoria ID'] || row['categoryId'],
        brand: row['Marca'] || row['brand'],
        shortDescription: row['Descripcion Corta'] || '',
        longDescription: row['Descripcion'] || '',
        specs: parseSpecs(row['Especificaciones']),
        requiresInstallation: row['Requiere Instalacion'] === 'Si',
        isActive: true,
        stock: parseInt(row['Stock']) || 0,
        price: parseFloat(row['Precio']) || 0
      }));
      
      resolve(products);
    };
    
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}
```

### 2. Frontend: Enviar al backend

```typescript
async function uploadInventory(products: Product[], token: string) {
  const response = await fetch(`${API_URL}/api/inventory/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      products,
      overwriteExisting: false
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }
  
  return response.json();
}
```

### 3. Frontend: Mostrar resultado

```typescript
const result = await uploadInventory(products, token);

console.log(`✅ Exitosos: ${result.data.successful}`);
console.log(`❌ Fallidos: ${result.data.failed}`);
console.log(`⏭️  Omitidos: ${result.data.skipped}`);

if (result.data.errors.length > 0) {
  console.log('Errores:', result.data.errors);
}
```

---

## 📋 Formato Excel Recomendado

| Nombre | Slug | Categoria ID | Marca | Descripcion Corta | Descripcion | Especificaciones | Requiere Instalacion | Stock | Precio |
|--------|------|--------------|-------|-------------------|-------------|------------------|---------------------|-------|--------|
| Microscopio | microscopio-digital | cat_123 | Olympus | Microscopio HD | Desc larga... | Aumento:40x-1000x;Peso:2kg | No | 10 | 250000 |

**Notas:**
- `Especificaciones`: formato `key:value;key2:value2`
- `Requiere Instalacion`: "Si" o "No"
- El `Slug` debe ser único (URL-friendly)

---

## 🧪 Testing

### Con curl

```bash
curl -X POST https://backend-amiweb-5udc-ksr25rpkq.vercel.app/api/inventory/upload \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "products": [
      {
        "name": "Test Product",
        "slug": "test-product",
        "categoryId": "existing_cat_id",
        "brand": "Test Brand",
        "shortDescription": "Short desc",
        "longDescription": "Long description",
        "specs": {},
        "requiresInstallation": false,
        "isActive": true
      }
    ],
    "overwriteExisting": false
  }'
```

---

## ⚠️ Consideraciones

1. **Límite de batch:** Máximo 500 productos por request
2. **Rate limiting:** Los requests están limitados por Vercel (no configurado aún)
3. **Slugs duplicados:** Se omiten por defecto a menos que `overwriteExisting: true`
4. **Validación de categorías:** El `categoryId` debe existir en Firestore
5. **Timeout:** Requests grandes pueden timeout (límite 10s en Vercel Hobby)

Para inventarios grandes (>500 productos), dividir en múltiples requests.
