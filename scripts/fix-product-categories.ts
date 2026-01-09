import { firestore, FieldValue } from '../src/lib/firebase';

/**
 * Script para asignar categorías correctas a productos
 * Ejecutar con: npm run fix-product-categories
 */

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Product {
  id: string;
  name: string;
  categoryId?: string;
  brand?: string;
}

// Mapeo de palabras clave a categorías
const CATEGORY_MAPPING: Record<string, string[]> = {
  // MICROBIOLOGÍA
  'microbiologia': [
    'hemocultivo', 'hemocult', 'TDR', 'bacteria', 'cultivo', 'agar', 'medio',
    'placa', 'petri', 'mueller', 'macconkey', 'columbia', 'sangre', 'EMB',
    'levine', 'sabouraud', 'tryptona', 'soya', 'caldo', 'cled', 'hiveg',
    'bioplate', 'duo', 'HTMS', 'parasit', 'tincion', 'gram', 'ziehl', 'neelsen',
    'baciloscopia', 'molecular', 'pcr', 'GC AGAR', 'dnasa', 'manitol', 'salado',
    'burkholderia', 'todd hewitt', 'citrato simmons', 'bilis esculina'
  ],
  
  // CONTROL DE CALIDAD (QC)
  'control-de-calidad': [
    'control', 'QC', 'calibr', 'standard', 'trulab', 'trucal', 'multicontrol',
    'nivel', 'level', 'quality control'
  ],
  
  // Coagulación
  'coagulacion': [
    'coagul', 'TTPA', 'APTT', 'PT', 'INR', 'fibrinog', 'hemosil', 'trombina',
    'factor', 'coagulometro'
  ],
  
  // Electrolitos
  'electrolitos': [
    'electrolito', 'sodio', 'potasio', 'cloro', 'K-lite', 'KS-401', 'CBS-300',
    'electrode', 'electrodo', 'ion', 'bicarbonato', 'B&E'
  ],
  
  // HPLC
  'hplc': [
    'HPLC', 'cromatograf', 'G8', 'tosoh', 'HbA1c', 'hemoglobin', 'tubing',
    'ferrule', 'graphite'
  ],
  
  // Hematología
  'hematologia': [
    'hematolog', 'hemograma', 'CBC', 'WBC', 'RBC', 'plaqueta', 'leucocito',
    'eritrocito', 'BCC', 'BF-', 'BH-', 'Urit', 'Dirui', 'Mindray', '2900',
    '3600', '3900', '5160', '5380', '5390', '6800', '6900', 'contador',
    'may grunwald', 'giemsa', 'hemocitometro', 'lyse', 'diluyente',
    'detergent', 'cleanser', 'chamber'
  ],
  
  // Inmunología
  'inmunologia': [
    'inmuno', 'ELISA', 'CLIA', 'maglumi', 'iflash', 'AIA', 'tosoh',
    'anticuerpo', 'antigeno', 'serol', 'HBsAg', 'HIV', 'TSH', 'T3', 'T4',
    'FT3', 'FT4', 'PSA', 'CEA', 'AFP', 'CA 19-9', 'TPO', 'vitamina',
    'hormone', 'pregnancy', 'HCG', 'drug test', 'latex'
  ],
  
  // Química Clínica
  'quimica-clinica': [
    'quimica', 'clinica', 'CS-', 'respons', 'glucosa', 'creatinin', 'urea',
    'colesterol', 'triglicerid', 'HDL', 'LDL', 'VLDL', 'bilirrubina',
    'proteina', 'albumina', 'globulina', 'transaminasa', 'ALT', 'AST',
    'ALAT', 'ASAT', 'GPT', 'GOT', 'fosfatasa', 'ALP', 'GGT', 'LDH',
    'amilasa', 'lipasa', 'CK', 'CPK', 'hierro', 'calcio', 'fosforo',
    'magnesio', 'acido urico', 'PCR', 'UIBC', 'autoanalizador', 'FS',
    'kit', 'reactivo', 'reagent', 'substrate', 'cubeta', 'cuvette'
  ],
  
  // Uroanálisis
  'uroanalisis': [
    'urin', 'orina', 'H-500', 'H500', 'H-800', 'H800', 'US-', 'dirui',
    'sediment', 'UQ-', 'URS', 'tira', 'strip', 'gravimeter', 'turbidity'
  ],
  
  // VHS
  'vhs': [
    'VHS', 'sediment', 'velocidad', 'globular', 'infla', 'quick', 'strumed',
    'westergren'
  ],
  
  // Veterinaria
  'veterinaria': [
    'vet', 'veterinar', 'animal', 'canino', 'felino'
  ],
  
  // Material de Plástico
  'material-de-plastico': [
    'tubo', 'vaculab', 'minilab', 'eppendorf', 'pipeta', 'punta',
    'gradilla', 'falcon', 'micropipeta', 'contenedor', 'frasco',
    'copita', 'recipiente', 'vaso', 'probeta'
  ],
  
  // Papeles y Etiquetas
  'papeles-y-etiquetas': [
    'papel', 'etiqueta', 'rollo', 'termico', 'thermal', 'ribbon',
    'transferencia', 'impres', 'film', 'resma'
  ],
  
  // Test Rápido
  'test-rapido': [
    'rapid test', 'test rapido', 'cassette', 'pregnancy', 'drug',
    'malaria', 'dengue', 'covid', 'strip test'
  ],
  
  // Toma de muestras
  'toma-de-muestras': [
    'aguja', 'lanceta', 'jeringa', 'syringe', 'butterfly', 'holder',
    'soporte', 'vacutainer', 'extraccion', 'venopun', 'torula', 'swab',
    'hisopo'
  ],
  
  // EPP
  'epp': [
    'guante', 'mascarilla', 'barbijo', 'gorro', 'cofia', 'bata',
    'delantal', 'proteccion', 'N95', 'KN95', 'quirurgico', 'nitrilo',
    'latex', 'cubre', 'calzado'
  ],
  
  // Despensa y Papelería
  'despensa-y-papeleria': [
    'cafe', 'te', 'azucar', 'papel', 'resma', 'sobre', 'carpeta',
    'archivador', 'lapiz', 'boligrafo', 'destacador', 'corrector',
    'corchete', 'clip', 'nota adhesiva', 'servilleta'
  ],
  
  // Centrífugas
  'centrifugas': [
    'centrifuga', 'centrifuge', 'rotor', 'spin'
  ],
  
  // Computación
  'computacion': [
    'computador', 'CPU', 'monitor', 'teclado', 'mouse', 'impresora',
    'toner', 'cartucho', 'PC', 'laptop', 'tablet', 'cable', 'USB'
  ],
  
  // Microscopios
  'microscopios': [
    'microscopio', 'microscope', 'objetivo', 'ocular', 'lente',
    'condensador', 'portaobjeto', 'cubreobjeto', 'camara', 'camera',
    'primostar', 'nexcope', 'axiocam', 'optic'
  ],
  
  // Marketing
  'marketing': [
    'amilab', 'logo', 'marca', 'promocion', 'catalogo', 'folleto',
    'banner', 'display'
  ],
  
  // Otros Periféricos Menores
  'otros-perifericos-menores': [
    'ups', 'estabilizador', 'regulador', 'bateria', 'pila', 'transformador',
    'adaptador', 'fuente', 'power supply', 'eliminador'
  ]
};

// Categorías de repuestos por equipos
const REPUESTOS_KEYWORDS = [
  'probe', 'sensor', 'valve', 'pump', 'motor', 'board', 'cable',
  'assembly', 'syringe', 'needle', 'tube', 'filter', 'membrane',
  'electrode', 'connector', 'tubing', 'housing', 'cartridge',
  'membrane', 'resina', 'osmosis', 'RO ', 'main board', 'power supply',
  'LCD', 'touch screen', 'fan', 'arm', 'transducer', 'chamber assembly'
];

// Productos de limpieza y suministros internos
const INTERNO_KEYWORDS = [
  'limpiador', 'detergente', 'desinfectante', 'jabon', 'toallita',
  'alcohol', 'cloro', 'lavaplatos', 'piso', 'basura', 'bolsa',
  'despensa', 'brocha', 'paño', 'esponja', 'caja plastica'
];

async function fixProductCategories() {
  console.log('🔧 REASIGNACIÓN DE CATEGORÍAS A PRODUCTOS\n');
  console.log('=' .repeat(80));

  try {
    // 1. Cargar todas las categorías
    console.log('\n📂 Cargando categorías...');
    const categoriesSnapshot = await firestore.collection('categories').get();
    const categories: Category[] = [];
    const categoryBySlug = new Map<string, Category>();

    categoriesSnapshot.forEach(doc => {
      const category: Category = {
        id: doc.id,
        name: doc.data().name,
        slug: doc.data().slug
      };
      categories.push(category);
      categoryBySlug.set(category.slug, category);
    });

    console.log(`✅ ${categories.length} categorías cargadas\n`);

    // 2. Cargar todos los productos
    console.log('📦 Cargando productos...');
    const productsSnapshot = await firestore.collection('products').get();
    const products: Product[] = [];

    productsSnapshot.forEach(doc => {
      products.push({
        id: doc.id,
        name: doc.data().name || '',
        categoryId: doc.data().categoryId,
        brand: doc.data().brand
      });
    });

    console.log(`✅ ${products.length} productos cargados\n`);

    // 3. Función para determinar categoría
    function findBestCategory(product: Product): string | null {
      const searchText = `${product.name} ${product.brand || ''}`.toLowerCase();

      // Primero verificar si es un repuesto
      const isRepuesto = REPUESTOS_KEYWORDS.some(keyword => 
        searchText.includes(keyword.toLowerCase())
      );

      // Si es repuesto y no tiene marca relacionada con reactivos, marcarlo
      if (isRepuesto && !searchText.includes('reagent kit')) {
        // Buscar categoría de periféricos (repuestos se incluyen aquí)
        const peripheralsCat = categoryBySlug.get('perifericos-de-equipamiento');
        if (peripheralsCat) return peripheralsCat.id;
      }

      // Verificar si es interno (limpieza, despensa)
      const isInterno = INTERNO_KEYWORDS.some(keyword =>
        searchText.includes(keyword.toLowerCase())
      );
      if (isInterno) {
        const internoCat = categoryBySlug.get('despensa-y-papeleria');
        if (internoCat) return internoCat.id;
      }

      // Buscar en el mapeo de categorías
      for (const [slug, keywords] of Object.entries(CATEGORY_MAPPING)) {
        const matchScore = keywords.filter(keyword =>
          searchText.includes(keyword.toLowerCase())
        ).length;

        if (matchScore > 0) {
          const category = categoryBySlug.get(slug);
          if (category) return category.id;
        }
      }

      return null;
    }

    // 4. Procesar productos en batches
    console.log('🔄 Procesando productos...\n');
    
    const batchSize = 500;
    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    const categoryStats = new Map<string, number>();

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = firestore.batch();
      const batchProducts = products.slice(i, i + batchSize);

      for (const product of batchProducts) {
        const newCategoryId = findBestCategory(product);

        if (newCategoryId) {
          const docRef = firestore.collection('products').doc(product.id);
          batch.update(docRef, {
            categoryId: newCategoryId,
            updatedAt: FieldValue.serverTimestamp()
          });

          // Estadísticas
          const category = categories.find(c => c.id === newCategoryId);
          if (category) {
            const count = categoryStats.get(category.name) || 0;
            categoryStats.set(category.name, count + 1);
          }

          updated++;
        } else {
          notFound++;
          if (notFound <= 10) {
            console.log(`⚠️  Sin categoría: ${product.name.substring(0, 60)}`);
          }
        }
      }

      await batch.commit();
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(products.length / batchSize);
      console.log(`✅ Batch ${batchNum}/${totalBatches} procesado`);
    }

    // 5. Resumen
    console.log('\n' + '=' .repeat(80));
    console.log('\n📊 DISTRIBUCIÓN POR CATEGORÍA:\n');

    const sortedStats = Array.from(categoryStats.entries())
      .sort((a, b) => b[1] - a[1]);

    sortedStats.forEach(([categoryName, count]) => {
      console.log(`📂 ${categoryName}: ${count} productos`);
    });

    console.log('\n' + '=' .repeat(80));
    console.log('\n✨ RESUMEN:\n');
    console.log(`✅ Actualizados: ${updated}`);
    console.log(`⚠️  Sin categoría asignada: ${notFound}`);
    console.log(`📦 Total procesados: ${products.length}`);

    if (notFound > 10) {
      console.log(`\n⚠️  Se omitieron ${notFound - 10} productos más sin categoría`);
    }

  } catch (error) {
    console.error('❌ Error reasignando categorías:', error);
    throw error;
  }
}

// Ejecutar
fixProductCategories()
  .then(() => {
    console.log('\n✨ Reasignación completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Reasignación falló:', error);
    process.exit(1);
  });
