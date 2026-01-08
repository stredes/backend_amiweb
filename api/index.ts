import { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    name: 'AMIWEB Backend API',
    version: '1.0.0',
    status: 'online',
    endpoints: {
      health: '/api/health',
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
        updateStatus: 'PATCH /api/support-requests/{id}/status'
      },
      contact: {
        list: 'GET /api/contact-messages',
        create: 'POST /api/contact-messages'
      }
    },
    documentation: 'https://github.com/stredes/backend_amiweb#readme'
  });
}
