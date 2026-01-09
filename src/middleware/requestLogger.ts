import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logger } from '../utils/logger';

/**
 * Middleware para logging automático de todas las requests
 * Captura información sobre la solicitud y el tiempo de respuesta
 */
export class RequestLogger {
  private startTime: number;
  private req: VercelRequest;
  private res: VercelResponse;

  constructor(req: VercelRequest, res: VercelResponse) {
    this.startTime = Date.now();
    this.req = req;
    this.res = res;
  }

  /**
   * Inicia el logging de la request
   */
  start(): void {
    const { method, url, headers } = this.req;
    const userId = (this.req as any).user?.uid;
    const ip = (headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown') as string;
    const userAgent = headers['user-agent'] as string;

    logger.info(`Request iniciado: ${method} ${url}`, {
      method,
      endpoint: url,
      userId,
      ip: ip.split(',')[0].trim(), // tomar la primera IP si hay múltiples
      userAgent: userAgent?.substring(0, 100) // limitar longitud
    });
  }

  /**
   * Finaliza el logging de la request con el código de estado
   */
  end(statusCode: number): void {
    const duration = Date.now() - this.startTime;
    const { method, url } = this.req;
    const userId = (this.req as any).user?.uid;
    const ip = (this.req.headers['x-forwarded-for'] || 
                this.req.headers['x-real-ip'] || 'unknown') as string;

    logger.request(
      method || 'UNKNOWN',
      url || '/',
      statusCode,
      duration,
      userId,
      ip.split(',')[0].trim()
    );

    // Log adicionales para requests lentas
    if (duration > 3000) {
      logger.warn('Request lenta detectada', {
        method,
        endpoint: url,
        duration: `${duration}ms`,
        statusCode
      });
    }

    // Log de eventos de negocio
    this.logBusinessEvents(statusCode);
  }

  /**
   * Registra eventos de negocio basados en el endpoint y resultado
   */
  private logBusinessEvents(statusCode: number): void {
    const { method, url } = this.req;
    
    if (!url) return;

    // Eventos de productos
    if (url.includes('/products') && method === 'POST' && statusCode === 201) {
      logger.event('product.created', { endpoint: url });
    } else if (url.includes('/products') && method === 'PUT' && statusCode === 200) {
      logger.event('product.updated', { endpoint: url });
    } else if (url.includes('/products') && method === 'DELETE' && statusCode === 200) {
      logger.event('product.deleted', { endpoint: url });
    }

    // Eventos de categorías
    if (url.includes('/categories') && method === 'POST' && statusCode === 201) {
      logger.event('category.created', { endpoint: url });
    } else if (url.includes('/categories') && method === 'PUT' && statusCode === 200) {
      logger.event('category.updated', { endpoint: url });
    }

    // Eventos de contacto
    if (url.includes('/contact-messages') && method === 'POST' && statusCode === 201) {
      logger.event('contact.message.received', { endpoint: url });
    }

    // Eventos de soporte
    if (url.includes('/support-requests') && method === 'POST' && statusCode === 201) {
      logger.event('support.request.created', { endpoint: url });
    } else if (url.includes('/support-requests') && method === 'PUT' && statusCode === 200) {
      logger.event('support.request.updated', { endpoint: url });
    }

    // Eventos de inventario
    if (url.includes('/inventory/upload') && method === 'POST' && statusCode === 200) {
      logger.event('inventory.uploaded', { endpoint: url });
    }
  }
}

/**
 * Helper para crear y usar el logger de requests
 */
export function createRequestLogger(req: VercelRequest, res: VercelResponse): RequestLogger {
  const requestLogger = new RequestLogger(req, res);
  requestLogger.start();
  return requestLogger;
}
