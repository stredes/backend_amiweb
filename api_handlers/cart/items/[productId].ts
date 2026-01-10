import { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef, nowTimestamp } from '../../../src/lib/firestore';
import { ok, fail } from '../../../src/utils/responses';
import { updateCartItemSchema } from '../../../src/validation/cartSchema';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import { logger } from '../../../src/utils/logger';
import { handleError } from '../../../src/utils/errorHandler';
import { CartItem } from '../../../src/models/cart';

/**
 * Calcula los totales del carrito
 */
function calculateTotals(items: CartItem[]): { subtotal: number; discount: number; tax: number; total: number } {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const discount = 0;
  const tax = subtotal * 0.1;
  const total = subtotal - discount + tax;

  return { subtotal, discount, tax, total };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);
  const { productId } = req.query;

  if (!productId || Array.isArray(productId)) {
    requestLogger.end(400);
    return fail(res, 'ID de producto inválido', 400);
  }

  const userId = req.headers['x-user-id'] as string | undefined;
  const sessionId = req.headers['x-session-id'] as string | undefined;

  if (!userId && !sessionId) {
    requestLogger.end(400);
    return fail(res, 'Se requiere x-user-id o x-session-id en headers', 400);
  }

  try {
    // Buscar el carrito
    let query;
    if (userId) {
      query = collectionRef('carts').where('userId', '==', userId).limit(1);
    } else {
      query = collectionRef('carts').where('sessionId', '==', sessionId).limit(1);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      requestLogger.end(404);
      return fail(res, 'Carrito no encontrado', 404);
    }

    const cartDoc = snapshot.docs[0];
    const cartId = cartDoc.id;
    const cart = cartDoc.data();

    // PATCH: Actualizar cantidad de un item
    if (req.method === 'PATCH') {
      logger.debug('Actualizando item del carrito', { cartId, productId, body: req.body });

      const parsed = updateCartItemSchema.safeParse(req.body);
      if (!parsed.success) {
        logger.warn('Validación fallida', { errors: parsed.error.errors });
        requestLogger.end(400);
        return fail(res, 'Cantidad inválida', 400, parsed.error.errors);
      }

      const { quantity } = parsed.data;

      // Buscar el item en el carrito
      const itemIndex = cart.items.findIndex((item: CartItem) => item.productId === productId);
      if (itemIndex === -1) {
        logger.warn('Item no encontrado en carrito', { cartId, productId });
        requestLogger.end(404);
        return fail(res, 'Producto no encontrado en el carrito', 404);
      }

      // Actualizar cantidad y subtotal
      cart.items[itemIndex].quantity = quantity;
      cart.items[itemIndex].subtotal = quantity * cart.items[itemIndex].unitPrice;

      // Recalcular totales
      const totals = calculateTotals(cart.items);

      // Actualizar en Firestore
      const dbStart = Date.now();
      await collectionRef('carts').doc(cartId).update({
        items: cart.items,
        ...totals,
        updatedAt: nowTimestamp()
      });
      const dbDuration = Date.now() - dbStart;

      logger.database('update', 'carts', true, dbDuration);
      logger.event('cart.item_updated', { cartId, productId, quantity });
      logger.info('Item del carrito actualizado', { cartId, productId });

      requestLogger.end(200);
      return ok(res, { 
        id: cartId, 
        items: cart.items, 
        ...totals 
      });
    }

    // DELETE: Eliminar un item del carrito
    if (req.method === 'DELETE') {
      logger.debug('Eliminando item del carrito', { cartId, productId });

      // Filtrar el item
      const updatedItems = cart.items.filter((item: CartItem) => item.productId !== productId);

      if (updatedItems.length === cart.items.length) {
        logger.warn('Item no encontrado en carrito', { cartId, productId });
        requestLogger.end(404);
        return fail(res, 'Producto no encontrado en el carrito', 404);
      }

      // Recalcular totales
      const totals = calculateTotals(updatedItems);

      // Actualizar en Firestore
      const dbStart = Date.now();
      await collectionRef('carts').doc(cartId).update({
        items: updatedItems,
        ...totals,
        updatedAt: nowTimestamp()
      });
      const dbDuration = Date.now() - dbStart;

      logger.database('update', 'carts', true, dbDuration);
      logger.event('cart.item_removed', { cartId, productId });
      logger.info('Item eliminado del carrito', { cartId, productId });

      requestLogger.end(200);
      return ok(res, { 
        id: cartId, 
        items: updatedItems, 
        ...totals 
      });
    }

    logger.warn('Método no permitido', { method: req.method });
    requestLogger.end(405);
    return fail(res, 'Método no permitido', 405);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: `/api/cart/items/${productId}`,
      method: req.method
    });
  }
}
