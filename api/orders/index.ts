import { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef, nowTimestamp } from '../../src/lib/firestore';
import { ok, fail } from '../../src/utils/responses';
import { parsePagination } from '../../src/utils/pagination';
import { createOrderSchema } from '../../src/validation/orderSchema';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import { logger } from '../../src/utils/logger';
import { handleError } from '../../src/utils/errorHandler';
import { Order } from '../../src/models/order';

/**
 * Genera un número de orden único
 */
function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD-${year}${month}-${random}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);
  
  try {
    // POST: Crear nueva orden
    if (req.method === 'POST') {
      logger.debug('Creando nueva orden', { body: req.body });
      
      const parsed = createOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        logger.warn('Validación de orden fallida', { errors: parsed.error.errors });
        requestLogger.end(400);
        return fail(res, 'Datos de orden inválidos', 400, parsed.error.errors);
      }

      const data = parsed.data;
      
      // Generar número de orden único
      let orderNumber = generateOrderNumber();
      let attempts = 0;
      while (attempts < 10) {
        const existing = await collectionRef('orders')
          .where('orderNumber', '==', orderNumber)
          .limit(1)
          .get();
        
        if (existing.empty) break;
        orderNumber = generateOrderNumber();
        attempts++;
      }

      const docRef = collectionRef('orders').doc();
      const order: Omit<Order, 'id'> = {
        orderNumber,
        ...data,
        status: 'pendiente',
        paymentStatus: 'pendiente',
        createdAt: nowTimestamp(),
        updatedAt: nowTimestamp()
      };

      const dbStart = Date.now();
      await docRef.set(order);
      const dbDuration = Date.now() - dbStart;
      
      logger.database('create', 'orders', true, dbDuration);
      logger.event('order.created', { orderId: docRef.id, orderNumber, total: data.total });
      logger.info('Orden creada exitosamente', { orderId: docRef.id, orderNumber });
      
      requestLogger.end(201);
      return ok(res, { id: docRef.id, ...order }, 201);
    }

    // GET: Listar órdenes
    if (req.method === 'GET') {
      const { status, paymentStatus, customerEmail, orderNumber } = req.query;
      const { page, pageSize, offset } = parsePagination(req.query as Record<string, string>);

      logger.debug('Consultando órdenes', { status, paymentStatus, page, pageSize });

      let query = collectionRef('orders').orderBy('createdAt', 'desc');

      // Filtros
      if (status && !Array.isArray(status)) {
        query = query.where('status', '==', status);
      }
      if (paymentStatus && !Array.isArray(paymentStatus)) {
        query = query.where('paymentStatus', '==', paymentStatus);
      }
      if (customerEmail && !Array.isArray(customerEmail)) {
        query = query.where('customerEmail', '==', customerEmail);
      }
      if (orderNumber && !Array.isArray(orderNumber)) {
        query = query.where('orderNumber', '==', orderNumber);
      }

      const dbStart = Date.now();
      const snapshot = await query.offset(offset).limit(pageSize).get();
      const dbDuration = Date.now() - dbStart;
      
      logger.database('query', 'orders', true, dbDuration);
      
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      logger.info('Órdenes consultadas exitosamente', { count: items.length, page });
      requestLogger.end(200);
      return ok(res, {
        items,
        total: items.length,
        page,
        pageSize
      });
    }

    logger.warn('Método no permitido', { method: req.method });
    requestLogger.end(405);
    return fail(res, 'Método no permitido', 405);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/orders',
      method: req.method
    });
  }
}
