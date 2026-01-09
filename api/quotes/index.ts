import { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef, nowTimestamp } from '../../src/lib/firestore';
import { ok, fail } from '../../src/utils/responses';
import { parsePagination } from '../../src/utils/pagination';
import { createQuoteSchema } from '../../src/validation/quoteSchema';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import { logger } from '../../src/utils/logger';
import { handleError } from '../../src/utils/errorHandler';
import { Quote } from '../../src/models/quote';

/**
 * Genera un número de cotización único
 */
function generateQuoteNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `QUO-${year}${month}-${random}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);
  
  try {
    // POST: Crear nueva solicitud de cotización
    if (req.method === 'POST') {
      logger.debug('Creando nueva cotización', { body: req.body });
      
      const parsed = createQuoteSchema.safeParse(req.body);
      if (!parsed.success) {
        logger.warn('Validación de cotización fallida', { errors: parsed.error.errors });
        requestLogger.end(400);
        return fail(res, 'Datos de cotización inválidos', 400, parsed.error.errors);
      }

      const data = parsed.data;
      
      // Generar número de cotización único
      let quoteNumber = generateQuoteNumber();
      let attempts = 0;
      while (attempts < 10) {
        const existing = await collectionRef('quotes')
          .where('quoteNumber', '==', quoteNumber)
          .limit(1)
          .get();
        
        if (existing.empty) break;
        quoteNumber = generateQuoteNumber();
        attempts++;
      }

      const docRef = collectionRef('quotes').doc();
      
      // Buscar vendedor asignado si el cliente existe
      let assignedSalesRep = '';
      let assignedSalesRepName = '';
      
      if (data.customerId) {
        const customerDoc = await collectionRef('customers').doc(data.customerId).get();
        if (customerDoc.exists) {
          const customerData = customerDoc.data();
          assignedSalesRep = customerData?.assignedSalesRep || '';
          assignedSalesRepName = customerData?.assignedSalesRepName || '';
        }
      }
      
      // Si no hay vendedor asignado, buscar por email del cliente
      if (!assignedSalesRep && data.customerEmail) {
        const customerSnapshot = await collectionRef('customers')
          .where('email', '==', data.customerEmail)
          .limit(1)
          .get();
        
        if (!customerSnapshot.empty) {
          const customerData = customerSnapshot.docs[0].data();
          assignedSalesRep = customerData?.assignedSalesRep || '';
          assignedSalesRepName = customerData?.assignedSalesRepName || '';
        }
      }
      
      const quote: Omit<Quote, 'id'> = {
        quoteNumber,
        ...data,
        assignedSalesRep,
        assignedSalesRepName,
        status: 'pendiente',
        createdAt: nowTimestamp(),
        updatedAt: nowTimestamp()
      };

      const dbStart = Date.now();
      await docRef.set(quote);
      const dbDuration = Date.now() - dbStart;
      
      logger.database('create', 'quotes', true, dbDuration);
      logger.event('quote.created', { quoteId: docRef.id, quoteNumber, itemCount: data.items.length });
      logger.info('Cotización creada exitosamente', { quoteId: docRef.id, quoteNumber });
      
      // Crear notificación para el vendedor asignado
      if (assignedSalesRep) {
        const { createNotification } = await import('../../src/utils/notifications');
        await createNotification({
          userId: assignedSalesRep,
          userRole: 'vendedor',
          type: 'quote_new',
          title: 'Nueva solicitud de cotización',
          message: `Nueva cotización ${quoteNumber} de ${data.customerName} requiere tu revisión`,
          relatedEntityType: 'quote',
          relatedEntityId: docRef.id,
          relatedEntityNumber: quoteNumber,
          priority: 'high',
          actionUrl: `/quotes/${docRef.id}`
        });
      }
      
      requestLogger.end(201);
      return ok(res, { id: docRef.id, ...quote }, 201);
    }

    // GET: Listar cotizaciones
    if (req.method === 'GET') {
      const { status, customerEmail, quoteNumber } = req.query;
      const { page, pageSize, offset } = parsePagination(req.query as Record<string, string>);

      logger.debug('Consultando cotizaciones', { status, page, pageSize });

      let query = collectionRef('quotes').orderBy('createdAt', 'desc');

      // Filtros
      if (status && !Array.isArray(status)) {
        query = query.where('status', '==', status);
      }
      if (customerEmail && !Array.isArray(customerEmail)) {
        query = query.where('customerEmail', '==', customerEmail);
      }
      if (quoteNumber && !Array.isArray(quoteNumber)) {
        query = query.where('quoteNumber', '==', quoteNumber);
      }

      const dbStart = Date.now();
      const snapshot = await query.offset(offset).limit(pageSize).get();
      const dbDuration = Date.now() - dbStart;
      
      logger.database('query', 'quotes', true, dbDuration);
      
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      logger.info('Cotizaciones consultadas exitosamente', { count: items.length, page });
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
      endpoint: '/api/quotes',
      method: req.method
    });
  }
}
