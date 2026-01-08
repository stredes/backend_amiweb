import { firestore, FieldValue } from '../src/lib/firebase';

/**
 * Script para inicializar colecciones de Firestore con datos de ejemplo
 * Ejecutar con: npx ts-node scripts/init-firestore.ts
 */

async function initFirestore() {
  console.log('🚀 Inicializando colecciones de Firestore...\n');

  try {
    // 1. Metadata
    console.log('📝 Creando metadata...');
    await firestore.collection('metadata').doc('site').set({
      siteName: 'AMILAB',
      siteDescription: 'Equipamiento científico y de laboratorio',
      contactEmail: 'contacto@amilab.cl',
      contactPhone: '+56 2 1234 5678',
      address: 'Santiago, Chile',
      updatedAt: FieldValue.serverTimestamp()
    });
    console.log('✅ Metadata creada\n');

    // 2. Categorías
    console.log('📂 Creando categorías...');
    const categories = [
      {
        name: 'Equipos de Laboratorio',
        slug: 'equipos-laboratorio',
        description: 'Equipos y dispositivos para laboratorios científicos',
        isActive: true
      },
      {
        name: 'Instrumentos de Medición',
        slug: 'instrumentos-medicion',
        description: 'Instrumentos de precisión para mediciones científicas',
        isActive: true
      },
      {
        name: 'Reactivos Químicos',
        slug: 'reactivos-quimicos',
        description: 'Reactivos y sustancias químicas para análisis',
        isActive: true
      },
      {
        name: 'Material de Vidrio',
        slug: 'material-vidrio',
        description: 'Cristalería y material de vidrio para laboratorio',
        isActive: true
      }
    ];

    const categoryIds: Record<string, string> = {};
    for (const category of categories) {
      const docRef = firestore.collection('categories').doc();
      await docRef.set({
        ...category,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      categoryIds[category.slug] = docRef.id;
      console.log(`  ✓ ${category.name}`);
    }
    console.log('✅ Categorías creadas\n');

    // 3. Productos
    console.log('📦 Creando productos...');
    const products = [
      {
        name: 'Microscopio Digital HD',
        slug: 'microscopio-digital-hd',
        categoryId: categoryIds['equipos-laboratorio'],
        brand: 'Olympus',
        shortDescription: 'Microscopio digital de alta definición con cámara integrada',
        longDescription: 'Microscopio digital profesional con resolución HD, zoom óptico 40x-1000x, iluminación LED y captura de imagen digital. Ideal para investigación y educación.',
        specs: {
          'Aumento': '40x-1000x',
          'Iluminación': 'LED',
          'Resolución cámara': '5MP',
          'Interfaz': 'USB 3.0'
        },
        requiresInstallation: false,
        isActive: true
      },
      {
        name: 'Balanza Analítica Precisión',
        slug: 'balanza-analitica-precision',
        categoryId: categoryIds['instrumentos-medicion'],
        brand: 'Mettler Toledo',
        shortDescription: 'Balanza analítica de precisión 0.0001g',
        longDescription: 'Balanza analítica de alta precisión con capacidad de 220g y precisión de 0.1mg. Calibración automática interna y pantalla táctil.',
        specs: {
          'Capacidad': '220g',
          'Precisión': '0.0001g',
          'Calibración': 'Automática',
          'Pantalla': 'Táctil LCD'
        },
        requiresInstallation: false,
        isActive: true
      },
      {
        name: 'pHmetro Digital Portátil',
        slug: 'phmetro-digital-portatil',
        categoryId: categoryIds['instrumentos-medicion'],
        brand: 'Hanna Instruments',
        shortDescription: 'Medidor de pH portátil con compensación de temperatura',
        longDescription: 'pHmetro digital portátil con electrodo reemplazable, compensación automática de temperatura y memoria para 500 mediciones.',
        specs: {
          'Rango pH': '0.00-14.00',
          'Precisión': '±0.01 pH',
          'Compensación temp': 'Automática',
          'Memoria': '500 lecturas'
        },
        requiresInstallation: false,
        isActive: true
      },
      {
        name: 'Matraz Aforado 100ml',
        slug: 'matraz-aforado-100ml',
        categoryId: categoryIds['material-vidrio'],
        brand: 'Brand',
        shortDescription: 'Matraz aforado de vidrio borosilicato clase A',
        longDescription: 'Matraz aforado de 100ml en vidrio borosilicato 3.3, clase A, con certificado individual de calibración. Resistente a temperaturas y productos químicos.',
        specs: {
          'Capacidad': '100ml',
          'Clase': 'A',
          'Material': 'Borosilicato 3.3',
          'Certificado': 'Incluido'
        },
        requiresInstallation: false,
        isActive: true
      },
      {
        name: 'Centrífuga Refrigerada',
        slug: 'centrifuga-refrigerada',
        categoryId: categoryIds['equipos-laboratorio'],
        brand: 'Eppendorf',
        shortDescription: 'Centrífuga refrigerada de alta velocidad',
        longDescription: 'Centrífuga refrigerada con control digital de velocidad y temperatura. Capacidad para 24 tubos de 1.5ml, velocidad máxima 15000 rpm.',
        specs: {
          'Velocidad máx': '15000 rpm',
          'Capacidad': '24 tubos x 1.5ml',
          'Temperatura': '-10°C a 40°C',
          'Control': 'Digital'
        },
        requiresInstallation: true,
        isActive: true
      }
    ];

    for (const product of products) {
      const docRef = firestore.collection('products').doc();
      await docRef.set({
        ...product,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
      console.log(`  ✓ ${product.name}`);
    }
    console.log('✅ Productos creados\n');

    // 4. Solicitud de soporte de ejemplo
    console.log('🎫 Creando solicitud de soporte de ejemplo...');
    await firestore.collection('supportRequests').doc().set({
      name: 'Juan Pérez',
      email: 'juan.perez@example.com',
      phone: '+56912345678',
      company: 'Universidad de Chile',
      serviceType: 'instalacion',
      productName: 'Centrífuga Refrigerada',
      message: 'Necesito agendar la instalación del equipo',
      status: 'pendiente',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    console.log('✅ Solicitud de soporte creada\n');

    // 5. Mensaje de contacto de ejemplo
    console.log('📧 Creando mensaje de contacto de ejemplo...');
    await firestore.collection('contactMessages').doc().set({
      name: 'María González',
      email: 'maria.gonzalez@example.com',
      subject: 'Consulta sobre productos',
      message: 'Quisiera recibir información sobre balanzas analíticas',
      createdAt: FieldValue.serverTimestamp()
    });
    console.log('✅ Mensaje de contacto creado\n');

    console.log('🎉 ¡Inicialización completada exitosamente!\n');
    console.log('📊 Resumen:');
    console.log(`  - 1 documento de metadata`);
    console.log(`  - ${categories.length} categorías`);
    console.log(`  - ${products.length} productos`);
    console.log(`  - 1 solicitud de soporte`);
    console.log(`  - 1 mensaje de contacto`);
    console.log('\n✅ Puedes verificar los datos en Firebase Console');

  } catch (error) {
    console.error('❌ Error durante la inicialización:', error);
    process.exit(1);
  }
}

// Ejecutar
initFirestore()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
