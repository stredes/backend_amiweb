#!/usr/bin/env ts-node
/**
 * Script para subir inventario desde archivo Excel directamente al backend
 * Uso: npm run upload-inventory
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// Configuración
const EXCEL_FILE_PATH = '/home/gian/Descargas/Informe_stock_fisico_20260107_190449.xls';
const API_URL = 'http://localhost:3000';
const LOGIN_EMAIL = 'root@amilab.com';
const LOGIN_PASSWORD = 'root2026';

interface Product {
  name: string;
  slug: string;
  categoryId: string;
  brand?: string;
  sku?: string;
  shortDescription?: string;
  longDescription?: string;
  price?: number;
  stock?: number;
  images?: string[];
  specs?: Record<string, any>;
  requiresInstallation?: boolean;
  isActive?: boolean;
}

// Helper para crear slug desde nombre
function createSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^a-z0-9\s-]/g, '') // Solo letras, números, espacios y guiones
    .trim()
    .replace(/\s+/g, '-') // Espacios a guiones
    .replace(/-+/g, '-'); // Múltiples guiones a uno solo
}

// Autenticación con Firebase
async function login(): Promise<string> {
  console.log('🔐 Autenticando con Firebase...');
  console.log('⚠️  NOTA: Necesitas obtener el token manualmente desde el frontend');
  console.log('   O configurar Firebase API Key en este script\n');
  
  // Opción 1: Usar token desde variable de entorno
  const token = process.env.FIREBASE_TOKEN;
  if (token) {
    console.log('✅ Token obtenido desde variable de entorno');
    return token;
  }

  // Opción 2: Intentar autenticación directa (requiere API Key de Firebase)
  const firebaseApiKey = process.env.FIREBASE_API_KEY || 'AIzaSyCUL7FqR8QqR7X0XYZ8vYZn4tQX9sV_qX8XwH3nqKqN3xH6M'; // Reemplazar con tu API Key
  
  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: LOGIN_EMAIL,
        password: LOGIN_PASSWORD,
        returnSecureToken: true
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error('Error de autenticación: ' + JSON.stringify(errorData));
    }

    const data = await response.json();
    console.log('✅ Autenticación exitosa');
    return data.idToken;
  } catch (error) {
    console.error('❌ Error de autenticación:', error);
    console.log('\n💡 Alternativa: Obtén el token manualmente:');
    console.log('   1. Inicia sesión en el frontend');
    console.log('   2. Abre DevTools → Application → IndexedDB → firebaseLocalStorage');
    console.log('   3. Copia el valor de "stsTokenManager.accessToken"');
    console.log('   4. Ejecuta: FIREBASE_TOKEN="tu-token" npm run upload-inventory\n');
    throw error;
  }
}

// Leer y parsear Excel
function parseExcel(filePath: string): Product[] {
  console.log('\n📖 Leyendo archivo Excel...');
  console.log(`   Archivo: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Archivo no encontrado: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  console.log(`✅ ${data.length} filas encontradas\n`);

  // Mapear columnas del Excel a nuestro modelo
  // Columnas del Excel: Familia, Subfamilia, Código, Producto, Unidad, etc.
  const products: Product[] = data.map((row: any, index: number) => {
    const name = row['Producto'] || '';
    const sku = row['Código'] || row['codigo'] || '';
    const family = row['Familia'] || '';
    const subfamily = row['Subfamilia'] || '';
    const stock = parseInt(row['Saldo stock'] || '0');
    const unit = row['Unidad'] || '';
    const warehouse = row['Bodega'] || '';
    const location = row['Ubicación'] || '';
    const serialNumber = row['N° Serie'] || '';
    const lot = row['Lote'] || '';
    const expirationDate = row['Fecha Vencimiento'] || '';

    if (!name || !sku) {
      console.warn(`⚠️  Fila ${index + 2}: Sin nombre o SKU, omitiendo`);
      return null;
    }

    const slug = createSlug(`${name}-${sku}`);

    return {
      name: name.trim(),
      slug,
      categoryId: family || 'sin-categoria',
      brand: subfamily || undefined,
      sku: sku || undefined,
      shortDescription: `${name} - ${family || ''} ${subfamily || ''}`.substring(0, 150),
      longDescription: `${name}\nFamilia: ${family}\nSubfamilia: ${subfamily}\nUnidad: ${unit}\nBodega: ${warehouse}\nUbicación: ${location}`,
      price: undefined, // No hay precio en este Excel
      stock: stock >= 0 ? stock : 0,
      images: [],
      specs: {
        familia: family,
        subfamilia: subfamily,
        unidad: unit,
        bodega: warehouse,
        ubicacion: location,
        ...(serialNumber && { numeroSerie: serialNumber }),
        ...(lot && { lote: lot }),
        ...(expirationDate && { fechaVencimiento: expirationDate })
      },
      requiresInstallation: false,
      isActive: stock > 0 // Activo solo si tiene stock
    };
  }).filter(p => p !== null) as Product[];

  console.log(`🔍 ${products.length} productos válidos para subir\n`);
  return products;
}

// Subir productos al backend
async function uploadProducts(token: string, products: Product[]): Promise<void> {
  console.log('📤 Subiendo productos al backend...');
  console.log(`   Cantidad: ${products.length} productos`);
  console.log(`   API: ${API_URL}/api/inventory/upload\n`);

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
    const errorText = await response.text();
    throw new Error(`Error del servidor (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅ CARGA COMPLETADA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Total procesados:  ${result.data.totalProcessed}`);
  console.log(`  ✅ Exitosos:       ${result.data.successful}`);
  console.log(`  ❌ Fallidos:       ${result.data.failed}`);
  console.log(`  ⏭️  Omitidos:       ${result.data.skipped}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (result.data.errors && result.data.errors.length > 0) {
    console.log('⚠️  Errores encontrados:\n');
    result.data.errors.slice(0, 10).forEach((error: any, index: number) => {
      console.log(`  #${index}: ${error.name}`);
      console.log(`     ${error.error}`);
      if (error.isTransient) {
        console.log('     ⚠️  Error transitorio - reintentar recomendado');
      }
      console.log('');
    });

    if (result.data.errors.length > 10) {
      console.log(`  ... y ${result.data.errors.length - 10} errores más.\n`);
    }
  }
}

// Main
async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  📦 SUBIDA DE INVENTARIO DESDE EXCEL');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // 1. Autenticar
    const token = await login();

    // 2. Leer Excel
    const products = parseExcel(EXCEL_FILE_PATH);

    if (products.length === 0) {
      console.log('❌ No hay productos para subir');
      process.exit(1);
    }

    // 3. Subir al backend
    await uploadProducts(token, products);

    console.log('✅ Proceso completado exitosamente!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Ejecutar
main();
