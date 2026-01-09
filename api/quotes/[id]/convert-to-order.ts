import { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef, nowTimestamp } from '../../../src/lib/firestore';
import { ok, fail } from '../../../src/utils/responses';
import { requireAuth, requireRole } from '../../../src/middleware/auth';
import { convertToOrderSchema } from '../../../src/validation/quoteSchema';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import { logger } from '../../../src/utils/logger';
import { handleError } from '../../../src/utils/errorHandler';
import { createNotification } from '../../../src/utils/notifications';
import { getFirebaseApp } from '../../../src/lib/firebase';

/**
 * POST /api/quotes/[id]/convert-to-order
 * Convierte una cotización aprobada en una orden
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);
  const { id } = req.query;

  if (!id || Array.isArray(id)) {
    requestLogger.end(400);
    return fail(res, 'ID de cotización inválido', 400);
  }

  if (req.method !== 'POST') {
    requestLogger.end(405);
    return fail(res, 'Método no permitido', 405);
  }

  try {
    // Verificar autenticación
    const isAuthenticated = await requireAuth(req, res);
    if (!isAuthenticated) {
      requestLogger.end(401);
      return;
    }

    const isAuthorized = await requireRole(req, res, ['cliente', 'socio', 'vendedor', 'admin', 'root']);
    if (!isAuthorized) {
      requestLogger.end(403);
      return;
    }

    const user = (req as any).user;
    const userId = user.uid;

    // Validar body
    const parsed = convertToOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn('Validación de conversión fallida', { errors: parsed.error.errors });
      requestLogger.end(400);
      return fail(res, 'Datos de conversión inválidos', 400, parsed.error.errors);
    }

    const { paymentMethod, shippingAddress, shippingMethod, notes } = parsed.data;

    logger.debug('Convirtiendo quote a orden', { quoteId: id, userId });

    const quoteRef = collectionRef('quotes').doc(id);
    const quoteDoc = await quoteRef.get();

    if (!quoteDoc.exists) {
      logger.warn('Cotización no encontrada', { quoteId: id });
      requestLogger.end(404);
      return fail(res, 'Cotización no encontrada', 404);
    }

    const quote = quoteDoc.data();

    // Verificar que está aprobada
    if (quote?.status !== 'aprobado') {
      logger.warn('Cotización no está aprobada', { quoteId: id, status: quote?.status });
      requestLogger.end(400);
      return fail(res, 'La cotización debe estar aprobada para convertirse en orden', 400);
    }

    // Verificar que no se haya convertido ya
    if (quote?.orderId) {
      logger.warn('Cotización ya convertida', { quoteId: id, orderId: quote.orderId });
      requestLogger.end(400);
      return fail(res, 'Esta cotización ya fue convertida en una orden', 400);
    }

    // Verificar que tenga totales
    if (!quote?.total || !quote?.items?.length) {
      logger.warn('Cotización sin totales', { quoteId: id });
      requestLogger.end(400);
      return fail(res, 'La cotización debe tener items y totales calculados', 400);
    }

    // Generar número de orden
    const orderNumber = `ORD-${Date.now()}`;

    // Crear la orden
    const orderData = {
      orderNumber,
      userId: quote.userId || userId,
      customerId: quote.customerId,
      
      // Información del cliente
      customerName: quote.customerName,
      customerEmail: quote.customerEmail,
      customerPhone: quote.customerPhone,
      organization: quote.organization,
      taxId: quote.taxId,
      
      // Vendedor asignado
      assignedSalesRep: quote.assignedSalesRep,
      assignedSalesRepName: quote.assignedSalesRepName,
      
      // Items
      items: quote.items,
      
      // Totales
      subtotal: quote.subtotal,
      discount: quote.discount || 0,
      tax: quote.tax || 0,
      total: quote.total,
      
      // Pago
      paymentMethod,
      paymentStatus: 'pendiente' as const,
      
      // Envío
      shippingAddress,
      shippingMethod: shippingMethod || 'despacho_standard',
      
      // Estado
      status: 'pendiente' as const,
      
      // Notas
      notes: notes || quote.quoteNotes,
      internalNotes: quote.internalNotes,
      
      // Referencias
      quoteId: id,
      quoteNumber: quote.quoteNumber,
      
      // Metadata
      createdAt: nowTimestamp(),
      updatedAt: nowTimestamp(),
      createdBy: userId
    };

    const dbStart = Date.now();
    const orderRef = await collectionRef('orders').add(orderData);
    const dbDuration = Date.now() - dbStart;

    logger.database('create', 'orders', true, dbDuration);

    // Actualizar la cotización
    await quoteRef.update({
      status: 'convertida',
      orderId: orderRef.id,
      updatedAt: nowTimestamp(),
      updatedBy: userId
    });

    logger.database('update', 'quotes', true);
    logger.event('quote.converted_to_order', {
      quoteId: id,
      orderId: orderRef.id,
      userId
    });
    logger.info('Cotización convertida a orden', {
      quoteId: id,
      orderId: orderRef.id
    });

    // Crear notificaciones
    // Notificar al vendedor
    if (quote.assignedSalesRep) {
      await createNotification({
        userId: quote.assignedSalesRep,
        userRole: 'vendedor',
        type: 'quote_converted',
        title: 'Cotización convertida a orden',
        message: `La cotización ${quote.quoteNumber} ha sido convertida a la orden ${orderNumber}`,
        relatedEntityType: 'order',
        relatedEntityId: orderRef.id,
        relatedEntityNumber: orderNumber,
        priority: 'high',
        actionUrl: `/orders/${orderRef.id}`
      });
    }

    // Notificar a admins
    const app = getFirebaseApp();
    const adminsSnapshot = await app.auth().listUsers();
    const adminUsers = adminsSnapshot.users.filter((u: any) =>
      u.customClaims?.role === 'admin' || u.customClaims?.role === 'root'
    );

    for (const adminUser of adminUsers) {
      await createNotification({
        userId: adminUser.uid,
        userRole: 'admin',
        type: 'order_new',
        title: 'Nueva orden creada',
        message: `Nueva orden ${orderNumber} creada desde cotización ${quote.quoteNumber}`,
        relatedEntityType: 'order',
        relatedEntityId: orderRef.id,
        relatedEntityNumber: orderNumber,
        priority: 'normal',
        actionUrl: `/admin/orders/${orderRef.id}`
      });
    }

    // Asignar automáticamente a bodega usando distribución equitativa
    const { assignOrderToWarehouse } = await import('../../../src/utils/warehouseAssignment');
    const itemCount = quote.items.reduce((sum: number, item: any) => sum + item.quantity, 0);
    
    let assignedWarehouseUser: any = null;
    try {
      const assignment = await assignOrderToWarehouse(itemCount);
      assignedWarehouseUser = assignment;

      // Crear preparación de orden asignada automáticamente
      const preparationData = {
        orderId: orderRef.id,
        orderNumber,
        status: 'asignado',
        assignedTo: assignment.assignedTo,
        assignedToName: assignment.assignedToName,
        assignedAt: nowTimestamp(),
        assignedBy: 'auto',
        items: quote.items.map((item: any) => ({
          productId: item.productId,
          productName: item.productName,
          quantityOrdered: item.quantity,
          quantityPrepared: 0,
          isPrepared: false
        })),
        totalItems: itemCount,
        preparedItems: 0,
        progress: 0,
        estimatedMinutes: (itemCount * 2) + 5,
        createdAt: nowTimestamp(),
        updatedAt: nowTimestamp()
      };

      await collectionRef('orderPreparations').add(preparationData);

      logger.info('Orden asignada automáticamente a bodega', {
        orderId: orderRef.id,
        assignedTo: assignment.assignedTo,
        assignedToName: assignment.assignedToName,
        itemCount
      });

      // Notificar solo al usuario asignado
      await createNotification({
        userId: assignment.assignedTo,
        userRole: 'bodega',
        type: 'order_new',
        title: 'Nueva orden asignada',
        message: `Nueva orden ${orderNumber} te ha sido asignada automáticamente (${itemCount} items)`,
        relatedEntityType: 'order',
        relatedEntityId: orderRef.id,
        relatedEntityNumber: orderNumber,
        priority: 'high',
        actionUrl: `/warehouse/orders/${orderRef.id}`
      });
    } catch (error) {
      logger.error('Error en asignación automática, notificando a todos', { error });
      
      // Si falla la asignación automática, notificar a todos
      const warehouseSnapshot = await app.auth().listUsers();
      const warehouseUsers = warehouseSnapshot.users.filter((u: any) =>
        u.customClaims?.role === 'bodega'
      );

      for (const warehouseUser of warehouseUsers) {
        await createNotification({
          userId: warehouseUser.uid,
          userRole: 'bodega',
          type: 'order_new',
          title: 'Nueva orden para preparar',
          message: `Nueva orden ${orderNumber} lista para preparación`,
          relatedEntityType: 'order',
          relatedEntityId: orderRef.id,
          relatedEntityNumber: orderNumber,
          priority: 'normal',
          actionUrl: `/warehouse/orders/${orderRef.id}`
        });
      }
    }

    // Notificar al cliente
    if (quote.userId) {
      await createNotification({
        userId: quote.userId,
        type: 'order_new',
        title: 'Tu orden ha sido creada',
        message: `Tu orden ${orderNumber} ha sido creada exitosamente y está siendo procesada`,
        relatedEntityType: 'order',
        relatedEntityId: orderRef.id,
        relatedEntityNumber: orderNumber,
        priority: 'high',
        actionUrl: `/orders/${orderRef.id}`
      });
    }

    // Obtener la orden creada
    const orderDoc = await orderRef.get();

    requestLogger.end(201);
    return ok(res, {
      order: { id: orderRef.id, ...orderDoc.data() },
      message: 'Orden creada exitosamente'
    }, 201);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: `/api/quotes/${id}/convert-to-order`,
      method: req.method
    });
  }
}
