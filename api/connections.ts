import { VercelRequest, VercelResponse } from '@vercel/node';
import { ok } from '../../src/utils/responses';
import { getConnectionInfo } from '../../src/middleware/connectionTracker';
import { logger } from '../../src/utils/logger';

/**
 * GET /api/connections
 * Endpoint de diagnóstico para ver conexiones del frontend
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  const connectionInfo = getConnectionInfo();
  
  logger.debug('Información de conexiones solicitada', connectionInfo);
  
  return ok(res, {
    status: 'Backend activo',
    ...connectionInfo,
    timestamp: new Date().toISOString()
  });
}
