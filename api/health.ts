import { VercelRequest, VercelResponse } from '@vercel/node';
import { env } from '../src/config/env';
import { ok } from '../src/utils/responses';
import { createRequestLogger } from '../src/middleware/requestLogger';
import { logger } from '../src/utils/logger';
import { getConnectionInfo } from '../src/middleware/connectionTracker';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);
  
  logger.debug('Health check realizado');
  
  const connectionInfo = getConnectionInfo();
  
  const response = ok(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV === 'production' ? 'prod' : 'dev',
    uptime: `${connectionInfo.backendUptime}s`,
    frontendConnections: connectionInfo.totalConnections,
    connectedOrigins: connectionInfo.connectedOrigins
  });
  
  requestLogger.end(200);
  return response;
}
