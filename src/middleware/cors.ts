import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logger } from '../utils/logger';
import { trackFrontendConnection } from './connectionTracker';

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
  'https://amilab.vercel.app',
  'https://www.amilab.cl',
  'https://amiweb.vercel.app',
  'https://backend-amiweb.vercel.app',
];

/**
 * Middleware CORS para permitir requests del frontend
 */
export function enableCors(req: VercelRequest, res: VercelResponse): void {
  const origin = (req.headers as any).origin as string | undefined;
  const isDevelopment = process.env.NODE_ENV === 'development' || 
                       process.env.VERCEL_ENV === 'development' ||
                       !process.env.VERCEL_ENV;

  // En desarrollo, permitir cualquier origen localhost
  const isLocalhost = origin && (
    origin.includes('localhost') || 
    origin.includes('127.0.0.1') ||
    origin.includes('192.168.')
  );

  if (origin && (ALLOWED_ORIGINS.includes(origin) || (isDevelopment && isLocalhost))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    logger.debug('CORS: Origen permitido', { origin });
    
    // Trackear conexión del frontend
    trackFrontendConnection(req);
  } else if (isDevelopment && !origin) {
    // Si no hay origin (ej: Postman), permitir en desarrollo
    res.setHeader('Access-Control-Allow-Origin', '*');
    logger.debug('CORS: Permitiendo todos los orígenes (desarrollo sin origin)');
  } else if (origin) {
    logger.warn('CORS: Origen no permitido bloqueado', { 
      origin,
      endpoint: req.url,
      isDevelopment 
    });
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
}

/**
 * Maneja preflight requests (OPTIONS)
 */
export function handleCorsPreFlight(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
    enableCors(req, res);
    res.status(204).end();
    return true;
  }
  return false;
}
