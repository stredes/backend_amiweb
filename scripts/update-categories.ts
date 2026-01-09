import { firestore, FieldValue } from '../src/lib/firebase';

/**
 * Script para actualizar categorías de AMILAB
 * Ejecutar con: npm run update-categories
 */

// Función para crear slug
function createSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^a-z0-9\s-]/g, '') // Eliminar caracteres especiales
    .replace(/\s+/g, '-') // Reemplazar espacios con guiones
    .replace(/-+/g, '-') // Eliminar guiones múltiples
    .trim();
}

interface Category {
  name: string;
  slug: string;
  description: string;
  subcategories?: string[];
  isActive: boolean;
}

async function updateCategories() {
  console.log('🚀 Actualizando categorías de AMILAB...\n');

  try {
    const categories: Category[] = [
      {
        name: 'CONTROL DE CALIDAD',
        slug: 'control-de-calidad',
        description: 'Controles de calidad para laboratorio',
        subcategories: ['QC CORE', 'CORE'],
        isActive: true
      },
      {
        name: 'Coagulación',
        slug: 'coagulacion',
        description: 'Productos para estudios de coagulación',
        isActive: true
      },
      {
        name: 'Electrolitos',
        slug: 'electrolitos',
        description: 'Reactivos y controles para electrolitos',
        isActive: true
      },
      {
        name: 'HPLC',
        slug: 'hplc',
        description: 'Cromatografía líquida de alta resolución',
        isActive: true
      },
      {
        name: 'Hematología',
        slug: 'hematologia',
        description: 'Productos para análisis hematológicos',
        isActive: true
      },
      {
        name: 'Inmunología',
        slug: 'inmunologia',
        description: 'Reactivos y equipos para inmunología',
        isActive: true
      },
      {
        name: 'Química Clínica',
        slug: 'quimica-clinica',
        description: 'Reactivos para química clínica',
        isActive: true
      },
      {
        name: 'Uroanálisis',
        slug: 'uroanalisis',
        description: 'Productos para análisis de orina',
        isActive: true
      },
      {
        name: 'VHS',
        slug: 'vhs',
        description: 'Velocidad de sedimentación globular',
        isActive: true
      },
      {
        name: 'Veterinaria',
        slug: 'veterinaria',
        description: 'Productos para diagnóstico veterinario',
        isActive: true
      },
      {
        name: 'INSUMOS',
        slug: 'insumos',
        description: 'Insumos generales de laboratorio',
        subcategories: [
          'Material de Plástico',
          'Papeles y Etiquetas',
          'Test Rápido',
          'Toma de muestras'
        ],
        isActive: true
      },
      {
        name: 'Material de Plástico',
        slug: 'material-de-plastico',
        description: 'Material descartable de plástico',
        isActive: true
      },
      {
        name: 'Papeles y Etiquetas',
        slug: 'papeles-y-etiquetas',
        description: 'Papeles térmicos, etiquetas y consumibles',
        isActive: true
      },
      {
        name: 'Test Rápido',
        slug: 'test-rapido',
        description: 'Tests rápidos de diagnóstico',
        isActive: true
      },
      {
        name: 'Toma de muestras',
        slug: 'toma-de-muestras',
        description: 'Material para toma de muestras',
        isActive: true
      },
      {
        name: 'INTERNO',
        slug: 'interno',
        description: 'Productos de uso interno',
        subcategories: [
          'Bioplates',
          'Complementarios',
          'Despensa y Papelería',
          'EPP',
          'Marketing'
        ],
        isActive: true
      },
      {
        name: 'Bioplates',
        slug: 'bioplates',
        description: 'Placas biológicas',
        isActive: true
      },
      {
        name: 'Complementarios',
        slug: 'complementarios',
        description: 'Productos complementarios',
        isActive: true
      },
      {
        name: 'Despensa y Papelería',
        slug: 'despensa-y-papeleria',
        description: 'Artículos de oficina y despensa',
        isActive: true
      },
      {
        name: 'EPP',
        slug: 'epp',
        description: 'Equipos de protección personal',
        isActive: true
      },
      {
        name: 'Marketing',
        slug: 'marketing',
        description: 'Material de marketing',
        isActive: true
      },
      {
        name: 'MICROBIOLOGÍA',
        slug: 'microbiologia',
        description: 'Productos para microbiología',
        subcategories: [
          'Cultivo acelerado',
          'Hemocultivos',
          'ID y AST',
          'Medios de cultivo',
          'Molecular',
          'Parasitológicos'
        ],
        isActive: true
      },
      {
        name: 'Cultivo acelerado',
        slug: 'cultivo-acelerado',
        description: 'Sistemas de cultivo acelerado',
        isActive: true
      },
      {
        name: 'Hemocultivos',
        slug: 'hemocultivos',
        description: 'Productos para hemocultivos',
        isActive: true
      },
      {
        name: 'ID y AST',
        slug: 'id-y-ast',
        description: 'Identificación y antibiogramas',
        isActive: true
      },
      {
        name: 'Medios de cultivo',
        slug: 'medios-de-cultivo',
        description: 'Medios de cultivo microbiológico',
        isActive: true
      },
      {
        name: 'Molecular',
        slug: 'molecular',
        description: 'Biología molecular',
        isActive: true
      },
      {
        name: 'Parasitológicos',
        slug: 'parasitologicos',
        description: 'Productos para parasitología',
        isActive: true
      },
      {
        name: 'PERIFÉRICOS',
        slug: 'perifericos',
        description: 'Periféricos y equipamiento',
        subcategories: [
          'Centrífugas',
          'Computación',
          'Microscopios',
          'Otros Periféricos Menores',
          'Periféricos de Equipamiento'
        ],
        isActive: true
      },
      {
        name: 'Centrífugas',
        slug: 'centrifugas',
        description: 'Centrífugas de laboratorio',
        isActive: true
      },
      {
        name: 'Computación',
        slug: 'computacion',
        description: 'Equipos de computación',
        isActive: true
      },
      {
        name: 'Microscopios',
        slug: 'microscopios',
        description: 'Microscopios y accesorios',
        isActive: true
      },
      {
        name: 'Otros Periféricos Menores',
        slug: 'otros-perifericos-menores',
        description: 'Periféricos menores diversos',
        isActive: true
      },
      {
        name: 'Periféricos de Equipamiento',
        slug: 'perifericos-de-equipamiento',
        description: 'Accesorios para equipamiento',
        isActive: true
      }
    ];

    // Verificar categorías existentes
    console.log('🔍 Verificando categorías existentes...');
    const existingSnapshot = await firestore.collection('categories').get();
    const existingCategories = new Map(
      existingSnapshot.docs.map(doc => [doc.data().slug, doc.id])
    );
    console.log(`   Encontradas: ${existingCategories.size} categorías existentes\n`);

    // Contadores
    let created = 0;
    let updated = 0;
    let skipped = 0;

    console.log('📂 Procesando categorías...\n');

    // Procesar en batches de 500 (límite de Firestore)
    const batchSize = 500;
    for (let i = 0; i < categories.length; i += batchSize) {
      const batch = firestore.batch();
      const batchCategories = categories.slice(i, i + batchSize);

      for (const category of batchCategories) {
        const existingId = existingCategories.get(category.slug);

        if (existingId) {
          // Actualizar categoría existente
          const docRef = firestore.collection('categories').doc(existingId);
          batch.update(docRef, {
            ...category,
            updatedAt: FieldValue.serverTimestamp()
          });
          console.log(`  ↻ Actualizando: ${category.name}`);
          updated++;
        } else {
          // Crear nueva categoría
          const docRef = firestore.collection('categories').doc();
          batch.set(docRef, {
            ...category,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          });
          console.log(`  ✓ Creando: ${category.name}`);
          created++;
        }
      }

      await batch.commit();
      console.log(`\n📦 Batch ${Math.floor(i / batchSize) + 1} guardado exitosamente\n`);
    }

    // Resumen
    console.log('\n✅ ACTUALIZACIÓN COMPLETADA\n');
    console.log('📊 Resumen:');
    console.log(`  ✓ Creadas: ${created}`);
    console.log(`  ↻ Actualizadas: ${updated}`);
    console.log(`  → Omitidas: ${skipped}`);
    console.log(`  📂 Total: ${categories.length}`);

  } catch (error) {
    console.error('❌ Error actualizando categorías:', error);
    throw error;
  }
}

// Ejecutar
updateCategories()
  .then(() => {
    console.log('\n✨ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script falló:', error);
    process.exit(1);
  });
