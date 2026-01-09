import { firestore } from '../src/lib/firebase';

/**
 * Script para analizar productos y categorías en Firebase
 * Ejecutar con: npm run analyze-products
 */

interface Product {
  id: string;
  name: string;
  sku?: string;
  categoryId?: string;
  brand?: string;
  familia?: string;
  subfamilia?: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

async function analyzeProductsAndCategories() {
  console.log('🔍 ANÁLISIS DE PRODUCTOS Y CATEGORÍAS\n');
  console.log('=' .repeat(80));

  try {
    // 1. Obtener todas las categorías
    console.log('\n📂 CATEGORÍAS DISPONIBLES:\n');
    const categoriesSnapshot = await firestore.collection('categories').get();
    const categories: Category[] = [];
    const categoryMap = new Map<string, Category>();

    categoriesSnapshot.forEach(doc => {
      const category: Category = {
        id: doc.id,
        name: doc.data().name || 'Sin nombre',
        slug: doc.data().slug || 'sin-slug',
        description: doc.data().description
      };
      categories.push(category);
      categoryMap.set(doc.id, category);
    });

    categories.sort((a, b) => a.name.localeCompare(b.name));

    categories.forEach((cat, index) => {
      console.log(`${index + 1}. ${cat.name}`);
      console.log(`   ID: ${cat.id}`);
      console.log(`   Slug: ${cat.slug}`);
      if (cat.description) {
        console.log(`   Descripción: ${cat.description}`);
      }
      console.log('');
    });

    console.log(`Total categorías: ${categories.length}`);
    console.log('=' .repeat(80));

    // 2. Obtener todos los productos
    console.log('\n📦 ANALIZANDO PRODUCTOS:\n');
    const productsSnapshot = await firestore.collection('products').get();
    const products: Product[] = [];

    productsSnapshot.forEach(doc => {
      const data = doc.data();
      products.push({
        id: doc.id,
        name: data.name || 'Sin nombre',
        sku: data.sku,
        categoryId: data.categoryId,
        brand: data.brand,
        familia: data.familia || data.category || data.familia,
        subfamilia: data.subfamilia || data.subcategory
      });
    });

    console.log(`Total productos: ${products.length}\n`);

    // 3. Análisis de asignación de categorías
    const productsWithCategory = products.filter(p => p.categoryId);
    const productsWithoutCategory = products.filter(p => !p.categoryId);
    const productsWithInvalidCategory = products.filter(p => 
      p.categoryId && !categoryMap.has(p.categoryId)
    );

    console.log('📊 ESTADÍSTICAS:\n');
    console.log(`✅ Productos con categoría: ${productsWithCategory.length}`);
    console.log(`❌ Productos sin categoría: ${productsWithoutCategory.length}`);
    console.log(`⚠️  Productos con categoría inválida: ${productsWithInvalidCategory.length}\n`);

    // 4. Distribución por categoría
    console.log('=' .repeat(80));
    console.log('\n📊 DISTRIBUCIÓN DE PRODUCTOS POR CATEGORÍA:\n');

    const categoryDistribution = new Map<string, Product[]>();
    
    productsWithCategory.forEach(product => {
      if (!product.categoryId) return;
      if (!categoryDistribution.has(product.categoryId)) {
        categoryDistribution.set(product.categoryId, []);
      }
      categoryDistribution.get(product.categoryId)!.push(product);
    });

    const sortedDistribution = Array.from(categoryDistribution.entries())
      .sort((a, b) => b[1].length - a[1].length);

    sortedDistribution.forEach(([categoryId, prods]) => {
      const category = categoryMap.get(categoryId);
      const categoryName = category ? category.name : `ID: ${categoryId} (NO ENCONTRADA)`;
      console.log(`📂 ${categoryName}: ${prods.length} productos`);
    });

    // 5. Análisis de campos familia/subfamilia
    console.log('\n' + '=' .repeat(80));
    console.log('\n🏷️  ANÁLISIS DE CAMPOS FAMILIA/SUBFAMILIA:\n');

    const familiaSet = new Set<string>();
    const subfamiliaSet = new Set<string>();

    products.forEach(product => {
      if (product.familia) familiaSet.add(product.familia);
      if (product.subfamilia) subfamiliaSet.add(product.subfamilia);
    });

    const familias = Array.from(familiaSet).sort();
    const subfamilias = Array.from(subfamiliaSet).sort();

    console.log('📋 FAMILIAS encontradas en productos:');
    familias.forEach((familia, index) => {
      const count = products.filter(p => p.familia === familia).length;
      console.log(`   ${index + 1}. "${familia}" (${count} productos)`);
    });

    console.log('\n📋 SUBFAMILIAS encontradas en productos:');
    subfamilias.forEach((subfamilia, index) => {
      const count = products.filter(p => p.subfamilia === subfamilia).length;
      console.log(`   ${index + 1}. "${subfamilia}" (${count} productos)`);
    });

    // 6. Muestra de productos sin categoría
    if (productsWithoutCategory.length > 0) {
      console.log('\n' + '=' .repeat(80));
      console.log('\n❌ PRODUCTOS SIN CATEGORÍA (muestra de 10):\n');
      
      productsWithoutCategory.slice(0, 10).forEach((product, index) => {
        console.log(`${index + 1}. ${product.name}`);
        if (product.sku) console.log(`   SKU: ${product.sku}`);
        if (product.familia) console.log(`   Familia: ${product.familia}`);
        if (product.subfamilia) console.log(`   Subfamilia: ${product.subfamilia}`);
        if (product.brand) console.log(`   Marca: ${product.brand}`);
        console.log('');
      });

      if (productsWithoutCategory.length > 10) {
        console.log(`... y ${productsWithoutCategory.length - 10} más`);
      }
    }

    // 7. Productos con categorías inválidas
    if (productsWithInvalidCategory.length > 0) {
      console.log('\n' + '=' .repeat(80));
      console.log('\n⚠️  PRODUCTOS CON CATEGORÍA INVÁLIDA:\n');
      
      productsWithInvalidCategory.forEach((product, index) => {
        console.log(`${index + 1}. ${product.name}`);
        console.log(`   ID Categoría inválido: ${product.categoryId}`);
        if (product.familia) console.log(`   Familia: ${product.familia}`);
        if (product.subfamilia) console.log(`   Subfamilia: ${product.subfamilia}`);
        console.log('');
      });
    }

    // 8. Mapeo sugerido
    console.log('\n' + '=' .repeat(80));
    console.log('\n💡 MAPEO SUGERIDO FAMILIA → CATEGORÍA:\n');

    const categoryNames = categories.map(c => c.name);
    
    familias.forEach(familia => {
      const count = products.filter(p => p.familia === familia).length;
      // Buscar categoría que coincida
      const matchingCategory = categories.find(cat => 
        cat.name.toLowerCase() === familia.toLowerCase() ||
        cat.slug === familia.toLowerCase().replace(/\s+/g, '-')
      );
      
      if (matchingCategory) {
        console.log(`✅ "${familia}" → "${matchingCategory.name}" (${count} productos)`);
        console.log(`   ID: ${matchingCategory.id}`);
      } else {
        console.log(`❓ "${familia}" → SIN MATCH EXACTO (${count} productos)`);
        // Buscar similares
        const similar = categories.filter(cat => 
          cat.name.toLowerCase().includes(familia.toLowerCase()) ||
          familia.toLowerCase().includes(cat.name.toLowerCase())
        );
        if (similar.length > 0) {
          console.log(`   Posibles: ${similar.map(c => `"${c.name}"`).join(', ')}`);
        }
      }
      console.log('');
    });

    // 9. Resumen final
    console.log('=' .repeat(80));
    console.log('\n✨ RESUMEN:\n');
    console.log(`📂 Categorías registradas: ${categories.length}`);
    console.log(`📦 Productos totales: ${products.length}`);
    console.log(`✅ Productos categorizados: ${productsWithCategory.length} (${Math.round(productsWithCategory.length / products.length * 100)}%)`);
    console.log(`❌ Productos sin categoría: ${productsWithoutCategory.length} (${Math.round(productsWithoutCategory.length / products.length * 100)}%)`);
    console.log(`⚠️  Productos con categoría inválida: ${productsWithInvalidCategory.length}`);
    console.log(`\n🏷️  Familias únicas: ${familias.length}`);
    console.log(`🏷️  Subfamilias únicas: ${subfamilias.length}`);

  } catch (error) {
    console.error('❌ Error analizando datos:', error);
    throw error;
  }
}

// Ejecutar
analyzeProductsAndCategories()
  .then(() => {
    console.log('\n✨ Análisis completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Análisis falló:', error);
    process.exit(1);
  });
