/**
 * Inicialización del backend
 * Este archivo se carga automáticamente al iniciar el servidor
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { showStartupBanner } from '../src/utils/startup';
import { getConnectionInfo } from '../src/middleware/connectionTracker';

// Mostrar banner solo la primera vez
let hasShownBanner = false;
if (!hasShownBanner) {
  showStartupBanner();
  hasShownBanner = true;
}

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const connectionInfo = getConnectionInfo();
  
  return res.status(200).json({
    name: 'AMIWEB Backend API',
    version: '1.0.0',
    status: 'online',
    uptime: `${connectionInfo.backendUptime}s`,
    frontendConnections: connectionInfo.totalConnections,
    connectedOrigins: connectionInfo.connectedOrigins,
    endpoints: {
      health: '/api/health',
      connections: '/api/connections',
      metadata: '/api/metadata',
      categories: {
        list: 'GET /api/categories',
        get: 'GET /api/categories/{id}',
        create: 'POST /api/categories',
        update: 'PUT /api/categories/{id}',
        delete: 'DELETE /api/categories/{id}'
      },
      products: {
        list: 'GET /api/products',
        get: 'GET /api/products/{id}',
        getBySlug: 'GET /api/products/slug/{slug}',
        create: 'POST /api/products',
        update: 'PUT /api/products/{id}',
        delete: 'DELETE /api/products/{id}'
      },
      support: {
        list: 'GET /api/support-requests',
        get: 'GET /api/support-requests/{id}',
        create: 'POST /api/support-requests',
        updateStatus: 'PATCH /api/support-requests/{id} (body: {status: "pendiente"|"en-proceso"|"resuelto"})'
      },
      contact: {
        list: 'GET /api/contact-messages',
        create: 'POST /api/contact-messages'
      },
      inventory: {
        upload: 'POST /api/inventory/upload (requires auth)'
      }
    },
    documentation: 'https://github.com/stredes/backend_amiweb#readme',
    authRequired: {
      note: 'Endpoints POST/PUT/PATCH/DELETE require Firebase Auth token',
      header: 'Authorization: Bearer <token>'
    }
  });
}
