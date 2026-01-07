import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://amilab.vercel.app',
  'https://www.amilab.cl',
  // Agregar dominios de producción
];

/**
 * Middleware CORS para permitir requests del frontend
 */
export function enableCors(req: VercelRequest, res: VercelResponse): void {
  const origin = (req.headers as any).origin as string | undefined;

  if (origin && (ALLOWED_ORIGINS.includes(origin) || process.env.NODE_ENV === 'development')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

/**
 * Maneja preflight requests (OPTIONS)
 */
export function handleCorsPreFlight(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
    enableCors(req, res);
    res.status(200).end();
    return true;
  }
  return false;
}
