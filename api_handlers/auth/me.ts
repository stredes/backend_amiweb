import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../../src/middleware/auth';
import { collectionRef } from '../../src/lib/firestore';
import { ok, fail } from '../../src/utils/responses';
import { handleError } from '../../src/utils/errorHandler';
import { createRequestLogger } from '../../src/middleware/requestLogger';

function mapRole(role?: string): 'socio' | 'admin' | 'root' | 'vendedor' | 'bodega' | 'callcenter' | 'soporte' {
  switch (role) {
    case 'root':
    case 'admin':
    case 'vendedor':
    case 'bodega':
    case 'callcenter':
    case 'soporte':
      return role;
    case 'cliente':
    case 'socio':
    default:
      return 'socio';
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);

  try {
    if (req.method !== 'GET') {
      requestLogger.end(405);
      return fail(res, 'Método no permitido', 405);
    }

    const isAuthenticated = await requireAuth(req, res);
    if (!isAuthenticated) {
      requestLogger.end(401);
      return;
    }

    const authUser = (req as any).user as { uid: string; email?: string; role?: string };
    const email = authUser.email || '';

    let vendorId: string | undefined;
    let company: string | undefined;
    let name = email.split('@')[0] || 'Usuario';

    if (email) {
      const customerByEmail = await collectionRef('customers').where('email', '==', email).limit(1).get();
      if (!customerByEmail.empty) {
        const customer = customerByEmail.docs[0].data();
        vendorId = customer?.assignedSalesRep;
        company = customer?.company;
        name = customer?.name || name;
      }
    }

    const role = mapRole(authUser.role);

    requestLogger.end(200);
    return ok(res, {
      user: {
        id: authUser.uid,
        email,
        name,
        role,
        company,
        vendorId,
      }
    });
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/auth/me',
      method: req.method
    });
  }
}
