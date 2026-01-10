import { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef, nowTimestamp } from '../../src/lib/firestore';
import { ok, fail } from '../../src/utils/responses';
import { addToCartSchema, updateCartItemSchema, updateCartSchema } from '../../src/validation/cartSchema';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import { logger } from '../../src/utils/logger';
import { handleError } from '../../src/utils/errorHandler';
import { Cart, CartItem } from '../../src/models/cart';

/**
 * Obtiene o crea un carrito para el usuario/sesión
 */
async function getOrCreateCart(userId?: string, sessionId?: string): Promise<{ id: string; cart: Cart }> {
  let query;
  
  if (userId) {
    query = collectionRef('carts').where('userId', '==', userId).limit(1);
  } else if (sessionId) {
    query = collectionRef('carts').where('sessionId', '==', sessionId).limit(1);
  } else {
    throw new Error('Se requiere userId o sessionId');
  }

  const snapshot = await query.get();

  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      cart: doc.data() as Cart
    };
  }

  // Crear nuevo carrito
  const docRef = collectionRef('carts').doc();
  const newCart: Cart = {
    userId,
    sessionId,
    items: [],
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
    createdAt: nowTimestamp(),
    updatedAt: nowTimestamp()
  };

  // Si es sesión, establecer expiración en 7 días
  if (sessionId && !userId) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    newCart.expiresAt = nowTimestamp(); // TODO: usar Timestamp con fecha futura
  }

  await docRef.set(newCart);

  return {
    id: docRef.id,
    cart: newCart
  };
}

/**
 * Calcula los totales del carrito
 */
function calculateTotals(items: CartItem[]): Pick<Cart, 'subtotal' | 'discount' | 'tax' | 'total'> {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const discount = 0; // TODO: aplicar lógica de descuentos
  const tax = subtotal * 0.1; // TODO: calcular IVA según configuración
  const total = subtotal - discount + tax;

  return {
    subtotal,
    discount,
    tax,
    total
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);
  
  // Obtener identificadores del usuario/sesión (desde headers o query)
  const userId = req.headers['x-user-id'] as string | undefined;
  const sessionId = req.headers['x-session-id'] as string | undefined;

  if (!userId && !sessionId) {
    requestLogger.end(400);
    return fail(res, 'Se requiere x-user-id o x-session-id en headers', 400);
  }

  try {
    // GET: Obtener carrito actual
    if (req.method === 'GET') {
      logger.debug('Consultando carrito', { userId, sessionId });

      const { id, cart } = await getOrCreateCart(userId, sessionId);

      logger.info('Carrito consultado exitosamente', { cartId: id, itemCount: cart.items.length });
      requestLogger.end(200);
      return ok(res, { id, ...cart });
    }

    // POST: Agregar producto al carrito
    if (req.method === 'POST') {
      logger.debug('Agregando producto al carrito', { body: req.body, userId, sessionId });

      const parsed = addToCartSchema.safeParse(req.body);
      if (!parsed.success) {
        logger.warn('Validación fallida al agregar al carrito', { errors: parsed.error.errors });
        requestLogger.end(400);
        return fail(res, 'Datos inválidos', 400, parsed.error.errors);
      }

      const { productId, quantity } = parsed.data;

      // Obtener o crear carrito
      const { id: cartId, cart } = await getOrCreateCart(userId, sessionId);

      // Obtener información del producto
      const productDoc = await collectionRef('products').doc(productId).get();
      if (!productDoc.exists) {
        logger.warn('Producto no encontrado', { productId });
        requestLogger.end(404);
        return fail(res, 'Producto no encontrado', 404);
      }

      const product = productDoc.data();
      if (!product) {
        logger.warn('Datos de producto no disponibles', { productId });
        requestLogger.end(404);
        return fail(res, 'Datos de producto no disponibles', 404);
      }
      if (!product.isActive) {
        logger.warn('Producto no disponible', { productId });
        requestLogger.end(400);
        return fail(res, 'Producto no disponible', 400);
      }

      // Verificar si el producto ya está en el carrito
      const existingItemIndex = cart.items.findIndex(item => item.productId === productId);

      if (existingItemIndex >= 0) {
        // Actualizar cantidad
        cart.items[existingItemIndex].quantity += quantity;
        cart.items[existingItemIndex].subtotal = 
          cart.items[existingItemIndex].quantity * cart.items[existingItemIndex].unitPrice;
      } else {
        // Agregar nuevo item
        const newItem: CartItem = {
          productId,
          productName: product.name,
          productCode: product.code,
          productImage: product.imageUrls?.[0],
          quantity,
          unitPrice: product.price || 0,
          subtotal: quantity * (product.price || 0),
          isAvailable: true,
          maxQuantity: product.stock
        };
        cart.items.push(newItem);
      }

      // Recalcular totales
      const totals = calculateTotals(cart.items);

      // Actualizar carrito en Firestore
      const dbStart = Date.now();
      await collectionRef('carts').doc(cartId).update({
        items: cart.items,
        ...totals,
        updatedAt: nowTimestamp()
      });
      const dbDuration = Date.now() - dbStart;

      logger.database('update', 'carts', true, dbDuration);
      logger.event('cart.item_added', { cartId, productId, quantity });
      logger.info('Producto agregado al carrito', { cartId, productId });

      requestLogger.end(200);
      return ok(res, { 
        id: cartId, 
        items: cart.items, 
        ...totals 
      });
    }

    // PUT: Actualizar todo el carrito
    if (req.method === 'PUT') {
      logger.debug('Actualizando carrito completo', { body: req.body, userId, sessionId });

      const parsed = updateCartSchema.safeParse(req.body);
      if (!parsed.success) {
        logger.warn('Validación fallida al actualizar carrito', { errors: parsed.error.errors });
        requestLogger.end(400);
        return fail(res, 'Datos inválidos', 400, parsed.error.errors);
      }

      const { items } = parsed.data;

      // Obtener o crear carrito
      const { id: cartId } = await getOrCreateCart(userId, sessionId);

      // Validar todos los productos y construir items completos
      const updatedItems: CartItem[] = [];

      for (const item of items) {
        const productDoc = await collectionRef('products').doc(item.productId).get();
        if (!productDoc.exists) continue;

        const product = productDoc.data();
        if (!product) continue;
        
        updatedItems.push({
          productId: item.productId,
          productName: product.name,
          productCode: product.code,
          productImage: product.imageUrls?.[0],
          quantity: item.quantity,
          unitPrice: product.price || 0,
          subtotal: item.quantity * (product.price || 0),
          isAvailable: product.isActive || false,
          maxQuantity: product.stock
        });
      }

      // Recalcular totales
      const totals = calculateTotals(updatedItems);

      // Actualizar carrito
      const dbStart = Date.now();
      await collectionRef('carts').doc(cartId).update({
        items: updatedItems,
        ...totals,
        updatedAt: nowTimestamp()
      });
      const dbDuration = Date.now() - dbStart;

      logger.database('update', 'carts', true, dbDuration);
      logger.event('cart.updated', { cartId, itemCount: updatedItems.length });
      logger.info('Carrito actualizado', { cartId });

      requestLogger.end(200);
      return ok(res, { 
        id: cartId, 
        items: updatedItems, 
        ...totals 
      });
    }

    // DELETE: Vaciar carrito
    if (req.method === 'DELETE') {
      logger.debug('Vaciando carrito', { userId, sessionId });

      const { id: cartId } = await getOrCreateCart(userId, sessionId);

      const dbStart = Date.now();
      await collectionRef('carts').doc(cartId).update({
        items: [],
        subtotal: 0,
        discount: 0,
        tax: 0,
        total: 0,
        updatedAt: nowTimestamp()
      });
      const dbDuration = Date.now() - dbStart;

      logger.database('update', 'carts', true, dbDuration);
      logger.event('cart.cleared', { cartId });
      logger.info('Carrito vaciado', { cartId });

      requestLogger.end(200);
      return ok(res, { message: 'Carrito vaciado exitosamente' });
    }

    logger.warn('Método no permitido', { method: req.method });
    requestLogger.end(405);
    return fail(res, 'Método no permitido', 405);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/cart',
      method: req.method
    });
  }
}
