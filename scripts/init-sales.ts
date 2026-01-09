import { firestore, FieldValue } from '../src/lib/firebase';

/**
 * Script para configurar índices y reglas de Firestore para el sistema de ventas
 * Ejecutar con: npm run init-sales
 */

async function initializeSalesCollections() {
  console.log('🚀 Inicializando colecciones de ventas en Firestore...\n');

  try {
    // 1. Crear colección de órdenes con documento de ejemplo
    console.log('📦 Inicializando colección de órdenes...');
    const ordersRef = firestore.collection('orders');
    const exampleOrder = {
      orderNumber: 'ORD-EXAMPLE',
      customerName: 'Cliente Ejemplo',
      customerEmail: 'ejemplo@amilab.com.py',
      customerPhone: '+595981234567',
      organization: 'Empresa Ejemplo S.A.',
      items: [
        {
          productId: 'example-product-id',
          productName: 'Producto de Ejemplo',
          quantity: 1,
          unitPrice: 100000,
          subtotal: 100000
        }
      ],
      subtotal: 100000,
      discount: 0,
      tax: 10000,
      shippingCost: 0,
      total: 110000,
      status: 'pendiente',
      paymentStatus: 'pendiente',
      shippingAddress: {
        street: 'Av. España 123',
        city: 'Asunción',
        state: 'Central',
        zipCode: '1234',
        country: 'Paraguay',
        phone: '+595981234567',
        contactName: 'Cliente Ejemplo'
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      _isExample: true
    };

    await ordersRef.doc('example-order').set(exampleOrder);
    console.log('  ✓ Colección de órdenes inicializada\n');

    // 2. Crear colección de cotizaciones con documento de ejemplo
    console.log('💬 Inicializando colección de cotizaciones...');
    const quotesRef = firestore.collection('quotes');
    const exampleQuote = {
      quoteNumber: 'QUO-EXAMPLE',
      customerName: 'Cliente Ejemplo',
      customerEmail: 'ejemplo@amilab.com.py',
      customerPhone: '+595981234567',
      organization: 'Empresa Ejemplo S.A.',
      items: [
        {
          productId: 'example-product-id',
          productName: 'Producto de Ejemplo',
          quantity: 1,
          unitPrice: 100000,
          subtotal: 100000
        }
      ],
      subtotal: 100000,
      discount: 0,
      tax: 10000,
      total: 110000,
      status: 'pendiente',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      _isExample: true
    };

    await quotesRef.doc('example-quote').set(exampleQuote);
    console.log('  ✓ Colección de cotizaciones inicializada\n');

    // 3. Crear colección de carritos con documento de ejemplo
    console.log('🛒 Inicializando colección de carritos...');
    const cartsRef = firestore.collection('carts');
    const exampleCart = {
      sessionId: 'example-session',
      items: [
        {
          productId: 'example-product-id',
          productName: 'Producto de Ejemplo',
          quantity: 1,
          unitPrice: 100000,
          subtotal: 100000,
          isAvailable: true
        }
      ],
      subtotal: 100000,
      discount: 0,
      tax: 10000,
      total: 110000,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      _isExample: true
    };

    await cartsRef.doc('example-cart').set(exampleCart);
    console.log('  ✓ Colección de carritos inicializada\n');

    // 4. Mostrar índices recomendados
    console.log('📋 ÍNDICES RECOMENDADOS PARA FIRESTORE:');
    console.log('\nÓrdenes (orders):');
    console.log('  - orderNumber (ASC/DESC)');
    console.log('  - customerEmail + createdAt (DESC)');
    console.log('  - status + createdAt (DESC)');
    console.log('  - paymentStatus + createdAt (DESC)');
    console.log('  - status + paymentStatus + createdAt (DESC)');
    
    console.log('\nCotizaciones (quotes):');
    console.log('  - quoteNumber (ASC/DESC)');
    console.log('  - customerEmail + createdAt (DESC)');
    console.log('  - status + createdAt (DESC)');
    
    console.log('\nCarritos (carts):');
    console.log('  - userId (ASC)');
    console.log('  - sessionId (ASC)');
    console.log('  - expiresAt (ASC) - para limpieza automática');

    console.log('\n📝 NOTA: Estos índices se crearán automáticamente cuando Firestore');
    console.log('         los requiera. También puedes crearlos manualmente desde la');
    console.log('         consola de Firebase.\n');

    // 5. Limpiar documentos de ejemplo (opcional)
    console.log('🧹 ¿Deseas eliminar los documentos de ejemplo?');
    console.log('   Puedes hacerlo manualmente desde la consola de Firebase\n');

    console.log('✅ INICIALIZACIÓN COMPLETADA\n');
    console.log('📊 Resumen:');
    console.log('  ✓ Colección orders creada');
    console.log('  ✓ Colección quotes creada');
    console.log('  ✓ Colección carts creada');
    console.log('  ✓ Documentos de ejemplo creados');

  } catch (error) {
    console.error('❌ Error inicializando colecciones:', error);
    throw error;
  }
}

// Ejecutar
initializeSalesCollections()
  .then(() => {
    console.log('\n✨ Script completado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script falló:', error);
    process.exit(1);
  });
