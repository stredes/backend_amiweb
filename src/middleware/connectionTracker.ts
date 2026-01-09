import type { VercelRequest, VercelResponse } from '@vercel/node';
import { logger } from '../utils/logger';

// Rastrear orígenes del frontend que se han conectado
const connectedOrigins = new Set<string>();
let backendStartTime = Date.now();

/**
 * Middleware para detectar y loggear conexiones del frontend
 */
export function trackFrontendConnection(req: VercelRequest): void {
  const origin = req.headers.origin as string | undefined;
  
  if (!origin) return;

  // Si es la primera vez que este origen se conecta, loggearlo
  if (!connectedOrigins.has(origin)) {
    connectedOrigins.add(origin);
    
    const timeSinceStart = Date.now() - backendStartTime;
    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
    
    // Mensaje visual prominente
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  🔗 FRONTEND CONECTADO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Origen:        ${origin}`);
    console.log(`  Tipo:          ${isLocalhost ? '🏠 Localhost (desarrollo)' : '🌐 Producción'}`);
    console.log(`  Tiempo:        ${(timeSinceStart / 1000).toFixed(1)}s desde inicio`);
    console.log(`  Endpoint:      ${req.method} ${req.url}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    logger.event('frontend.connected', {
      origin,
      isLocalhost,
      firstEndpoint: req.url
    });
  }
}

/**
 * Obtener información de conexiones activas
 */
export function getConnectionInfo() {
  return {
    connectedOrigins: Array.from(connectedOrigins),
    totalConnections: connectedOrigins.size,
    backendUptime: Math.floor((Date.now() - backendStartTime) / 1000)
  };
}

/**
 * Reiniciar el tracking (útil para testing)
 */
export function resetConnectionTracking(): void {
  connectedOrigins.clear();
  backendStartTime = Date.now();
}
