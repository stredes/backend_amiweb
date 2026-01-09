#!/usr/bin/env ts-node
/**
 * Script para subir inventario directamente a Firestore desde Excel
 * Usa Firebase Admin SDK (sin necesidad de autenticación)
 * Uso: npm run upload-inventory-direct
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { firestore, FieldValue } from '../src/lib/firebase';

// Configuración
const EXCEL_FILE_PATH = '/home/gian/Descargas/Informe_stock_fisico_20260107_190449.xls';

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
  createdAt: any;
  updatedAt: any;
}

// Helper para crear slug
function createSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
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

  // Mapear columnas del Excel
  const products: Product[] = data.map((row: any, index: number) => {
    const name = row['Producto'] || '';
    const sku = row['Código'] || '';
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
      isActive: stock > 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };
  }).filter(p => p !== null) as Product[];

  // Eliminar duplicados (mismo nombre + SKU)
  const seen = new Map<string, Product>();
  const uniqueProducts: Product[] = [];
  
  products.forEach(product => {
    const key = `${product.name}-${product.sku}`;
    if (!seen.has(key)) {
      seen.set(key, product);
      uniqueProducts.push(product);
    }
  });

  console.log(`🔍 ${products.length} productos parseados`);
  console.log(`✅ ${uniqueProducts.length} productos únicos (después de eliminar duplicados)\n`);
  
  return uniqueProducts;
}

// Subir a Firestore en batches
async function uploadToFirestore(products: Product[]): Promise<void> {
  console.log('📤 Subiendo productos a Firestore...\n');

  const batchSize = 500; // Máximo de Firestore
  let totalSuccess = 0;
  let totalFailed = 0;
  const errors: Array<{ name: string; error: string }> = [];

  // Obtener productos existentes para evitar duplicados
  console.log('🔍 Verificando productos existentes...');
  const existingProducts = new Map<string, string>();
  const existingSnapshot = await firestore.collection('products').get();
  existingSnapshot.docs.forEach(doc => {
    const data = doc.data();
    existingProducts.set(data.slug, doc.id);
  });
  console.log(`   Encontrados: ${existingProducts.size} productos existentes\n`);

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = firestore.batch();
    const chunk = products.slice(i, i + batchSize);
    
    console.log(`📦 Procesando batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(products.length / batchSize)} (${chunk.length} productos)...`);

    for (const product of chunk) {
      try {
        const existingId = existingProducts.get(product.slug);
        
        if (existingId) {
          // Actualizar existente
          const docRef = firestore.collection('products').doc(existingId);
          batch.update(docRef, product as any);
        } else {
          // Crear nuevo
          const docRef = firestore.collection('products').doc();
          batch.set(docRef, product as any);
        }
        
        totalSuccess++;
      } catch (error) {
        totalFailed++;
        errors.push({
          name: product.name,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    try {
      await batch.commit();
      console.log(`   ✅ Batch guardado exitosamente`);
    } catch (error) {
      console.error(`   ❌ Error al guardar batch:`, error);
      totalFailed += chunk.length;
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅ CARGA COMPLETADA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Total procesados:  ${products.length}`);
  console.log(`  ✅ Exitosos:       ${totalSuccess}`);
  console.log(`  ❌ Fallidos:       ${totalFailed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (errors.length > 0) {
    console.log('⚠️  Errores encontrados:\n');
    errors.slice(0, 10).forEach((error, index) => {
      console.log(`  #${index}: ${error.name}`);
      console.log(`     ${error.error}\n`);
    });

    if (errors.length > 10) {
      console.log(`  ... y ${errors.length - 10} errores más.\n`);
    }
  }
}

// Main
async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  📦 SUBIDA DIRECTA DE INVENTARIO A FIRESTORE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // 1. Leer Excel
    const products = parseExcel(EXCEL_FILE_PATH);

    if (products.length === 0) {
      console.log('❌ No hay productos para subir');
      process.exit(1);
    }

    // 2. Subir a Firestore
    await uploadToFirestore(products);

    console.log('✅ Proceso completado exitosamente!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Ejecutar
main();
