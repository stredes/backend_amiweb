import { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef, nowTimestamp } from '../../src/lib/firestore';
import { ok, fail } from '../../src/utils/responses';
import { parsePagination } from '../../src/utils/pagination';
import { contactMessageSchema } from '../../src/validation/contactMessageSchema';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import { logger } from '../../src/utils/logger';
import { handleError } from '../../src/utils/errorHandler';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);
  
  try {
    if (req.method === 'POST') {
      logger.debug('Recibiendo mensaje de contacto', { 
        name: req.body?.name,
        email: req.body?.email 
      });
      
      const parsed = contactMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        logger.warn('Validación de mensaje de contacto fallida', { 
          errors: parsed.error.errors 
        });
        requestLogger.end(400);
        return fail(res, 'Invalid contact message payload', 400);
      }

      const data = parsed.data;
      const docRef = collectionRef('contactMessages').doc();
      const payload = {
        ...data,
        createdAt: nowTimestamp()
      };

      const dbStart = Date.now();
      await docRef.set(payload);
      logger.database('create', 'contactMessages', true, Date.now() - dbStart);
      
      logger.event('contact.message.received', { 
        messageId: docRef.id,
        email: data.email,
        name: data.name
      });
      logger.info('Mensaje de contacto guardado', { messageId: docRef.id });
      
      requestLogger.end(201);
      return ok(res, { id: docRef.id, ...payload }, 201);
    }

    if (req.method === 'GET') {
      const { page, pageSize, offset } = parsePagination(req.query as Record<string, string>);
      
      logger.debug('Consultando mensajes de contacto', { page, pageSize });
      
      const dbStart = Date.now();
      const snapshot = await collectionRef('contactMessages')
        .orderBy('createdAt', 'desc')
        .offset(offset)
        .limit(pageSize)
        .get();
      logger.database('query', 'contactMessages', true, Date.now() - dbStart);

      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      logger.info('Mensajes de contacto consultados', { count: items.length });
      requestLogger.end(200);
      return ok(res, { items, total: items.length, page, pageSize });
    }

    logger.warn('Método no permitido', { method: req.method });
    requestLogger.end(405);
    return fail(res, 'Method not allowed', 405);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/contact-messages',
      method: req.method
    });
  }
}
