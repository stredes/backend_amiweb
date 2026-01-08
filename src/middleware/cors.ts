import type { VercelRequest, VercelResponse } from '@vercel/node';

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
  } else if (isDevelopment && !origin) {
    // Si no hay origin (ej: Postman), permitir en desarrollo
    res.setHeader('Access-Control-Allow-Origin', '*');
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
