/**
 * Inicialización del backend
 * Este archivo se carga automáticamente al iniciar el servidor
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { showStartupBanner } from '../src/utils/startup';
import { getConnectionInfo } from '../src/middleware/connectionTracker';
import { enableCors, handleCorsPreFlight } from '../src/middleware/cors';

// Mostrar banner solo la primera vez
let hasShownBanner = false;
if (!hasShownBanner) {
  showStartupBanner();
  hasShownBanner = true;
}

export default function handler(_req: VercelRequest, res: VercelResponse) {
  enableCors(_req, res);
  if (handleCorsPreFlight(_req, res)) {
    return;
  }

  const connectionInfo = getConnectionInfo();
  
  return res.status(200).json({
    name: 'AMIWEB Backend API',
    version: '1.1.0',
    status: 'online',
    uptime: `${connectionInfo.backendUptime}s`,
    versioning: {
      active: '/api/v1',
      compatibility: ['/api/*', '/api/v1/*']
    },
    telemetry: {
      frontendConnections: connectionInfo.totalConnections,
      connectedOrigins: connectionInfo.connectedOrigins,
      note: 'Valores informativos basados en el tracker local; no representan sesiones persistentes.'
    },
    endpoints: {
      health: '/api/health',
      ready: '/api/ready',
      metadata: '/api/metadata',
      search: 'GET /api/search',
      auth: {
        me: 'GET /api/auth/me'
      },
      notifications: {
        list: 'GET /api/notifications',
        update: 'PATCH /api/notifications',
        delete: 'DELETE /api/notifications'
      },
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
      orders: {
        list: 'GET /api/orders',
        create: 'POST /api/orders',
        get: 'GET /api/orders/{id}',
        update: 'PATCH /api/orders/{id}',
        delete: 'DELETE /api/orders/{id}'
      },
      quotes: {
        list: 'GET /api/quotes',
        get: 'GET /api/quotes/{id}',
        create: 'POST /api/quotes',
        update: 'PUT /api/quotes/{id}',
        delete: 'DELETE /api/quotes/{id}',
        vendorPending: 'GET /api/quotes/vendor/pending',
        vendorApprove: 'POST /api/quotes/{id}/vendor-approve',
        adminApprove: 'POST /api/quotes/{id}/admin-approve',
        convertToOrder: 'POST /api/quotes/{id}/convert-to-order'
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
      cart: {
        get: 'GET /api/cart',
        update: 'POST /api/cart',
        item: 'DELETE /api/cart/items/{productId}'
      },
      users: {
        list: 'GET /api/users',
        create: 'POST /api/users',
        get: 'GET /api/users/{id}',
        update: 'PUT /api/users/{id}',
        delete: 'DELETE /api/users/{id}',
        byRole: 'GET /api/users/role/{role}',
        status: 'PATCH /api/users/{id}/status',
        resetPassword: 'POST /api/users/{id}/reset-password',
        audit: 'GET /api/users/{id}/audit',
        summary: 'GET /api/users/views/summary'
      },
      workflows: {
        checklist: 'GET /api/workflows/checklist'
      },
      inventory: {
        upload: 'POST /api/inventory/upload (requires auth)'
      },
      admin: {
        kpis: 'GET /api/admin/kpis',
        clients: 'GET /api/admin/clients',
        operations: 'GET /api/admin/operations',
        approvalsPending: 'GET /api/admin/approvals/pending',
        exports: {
          executive: 'GET /api/admin/exports/executive',
          orders: 'GET /api/admin/exports/orders',
          clients: 'GET /api/admin/exports/clients'
        },
        assistant: {
          query: 'POST /api/admin/assistant/query',
          suggestions: 'GET /api/admin/assistant/suggestions',
          history: 'GET /api/admin/assistant/history'
        }
      },
      vendor: {
        kpis: 'GET /api/vendor/kpis',
        pipeline: 'GET /api/vendor/pipeline',
        agenda: 'GET /api/vendor/agenda',
        clients: 'GET /api/vendor/clients',
        orders: 'GET /api/vendor/orders',
        quotesPending: 'GET /api/vendor/quotes/pending',
        approveQuote: 'POST /api/vendor/quotes/{id}/approve',
        rejectQuote: 'POST /api/vendor/quotes/{id}/reject',
        exports: {
          orders: 'GET /api/vendor/exports/orders.csv',
          clients: 'GET /api/vendor/exports/clients.csv',
          pipeline: 'GET /api/vendor/exports/pipeline.csv'
        }
      },
      warehouse: {
        stock: 'GET /api/warehouse/stock',
        stockExport: 'GET /api/warehouse/stock/export',
        orders: 'GET /api/warehouse/orders',
        stats: 'GET /api/warehouse/stats',
        prepare: 'POST /api/warehouse/prepare/{orderId}',
        approveDispatch: 'POST /api/warehouse/approve-dispatch/{orderId}',
        dispatch: 'POST /api/warehouse/dispatch/{orderId}',
        reassign: 'POST /api/warehouse/reassign/{orderId}',
        catalog: {
          familias: 'GET /api/warehouse/catalog/familias',
          subfamilias: 'GET /api/warehouse/catalog/subfamilias',
          marcas: 'GET /api/warehouse/catalog/marcas',
          origenes: 'GET /api/warehouse/catalog/origenes',
          bodegas: 'GET /api/warehouse/catalog/bodegas',
          ubicaciones: 'GET /api/warehouse/catalog/ubicaciones',
          unidadesNegocio: 'GET /api/warehouse/catalog/unidades-negocio'
        }
      }
    },
    documentation: {
      readme: 'https://github.com/stredes/backend_amiweb#readme',
      contract: '/docs/API_SYNC_CONTRACT.md',
      openapi: '/docs/openapi.v1.yaml'
    },
    authRequired: {
      note: 'Endpoints protegidos requieren Firebase Auth token',
      header: 'Authorization: Bearer <token>'
    },
    assistant: {
      status: 'enabled',
      scope: 'admin-read-only',
      endpoint: 'POST /api/admin/assistant/query',
      suggestions: 'GET /api/admin/assistant/suggestions',
      history: 'GET /api/admin/assistant/history',
      output: 'answer + table + meta/requestId'
    }
  });
}
