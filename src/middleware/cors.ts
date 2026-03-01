import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logger } from '../utils/logger';
import { trackFrontendConnection } from './connectionTracker';

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
  'https://amilab.cl',
  'https://amilab.vercel.app',
  'https://www.amilab.cl',
  'https://amiweb.vercel.app',
  'https://amiweb-theta.vercel.app',
  'https://backend-amiweb.vercel.app',
];

function getConfiguredOrigins(): string[] {
  const raw = process.env.CORS_ALLOWED_ORIGINS;
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin: string, isDevelopment: boolean): boolean {
  const configuredOrigins = getConfiguredOrigins();
  if (ALLOWED_ORIGINS.includes(origin) || configuredOrigins.includes(origin)) {
    return true;
  }

  try {
    const hostname = new URL(origin).hostname.toLowerCase();

    // Soporta previews de Vercel cuando se habilita explícitamente.
    const allowAllVercelPreviews =
      isDevelopment || process.env.CORS_ALLOW_VERCEL_PREVIEWS === 'true';
    if (allowAllVercelPreviews && hostname.endsWith('.vercel.app')) {
      return true;
    }

    if (hostname.endsWith('.vercel.app')) {
      return hostname.includes('amiweb') || hostname.includes('amilab') || hostname.includes('backend-amiweb');
    }
  } catch {
    return false;
  }

  return false;
}

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

  if (origin && (isAllowedOrigin(origin, isDevelopment) || (isDevelopment && isLocalhost))) {
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
