import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirebaseApp } from '../../../src/lib/firebase';
import { collectionRef } from '../../../src/lib/firestore';
import { requireAuth, requireRole } from '../../../src/middleware/auth';
import { ok, fail } from '../../../src/utils/responses';
import { handleError } from '../../../src/utils/errorHandler';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import type { UserRole } from '../../../src/models/user';

const ALLOWED_ROLES: UserRole[] = ['root', 'admin', 'vendedor', 'bodega', 'callcenter', 'soporte', 'socio', 'cliente'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);
  const { role } = req.query;

  if (!role || Array.isArray(role) || !ALLOWED_ROLES.includes(role as UserRole)) {
    requestLogger.end(400);
    return fail(res, 'Rol inválido', 400);
  }

  try {
    const isAuthenticated = await requireAuth(req, res);
    if (!isAuthenticated) {
      requestLogger.end(401);
      return;
    }

    const isAuthorized = requireRole(req, res, ['root', 'admin', 'vendedor', 'socio', 'cliente', 'bodega', 'callcenter', 'soporte']);
    if (!isAuthorized) {
      requestLogger.end(403);
      return;
    }

    if (req.method !== 'GET') {
      requestLogger.end(405);
      return fail(res, 'Método no permitido', 405);
    }

    const app = getFirebaseApp();
    const list = await app.auth().listUsers(1000);
    let users = list.users
      .filter((u) => (u.customClaims?.role || 'cliente') === role)
      .map((u) => ({
        id: u.uid,
        email: u.email || '',
        name: u.displayName || u.email?.split('@')[0] || 'Usuario',
        role,
        phone: u.phoneNumber || undefined,
        isActive: !u.disabled,
      }));

    const assignedSalesRep = typeof req.query.vendorId === 'string' ? req.query.vendorId : undefined;

    if (role === 'socio' && assignedSalesRep) {
      const customersSnapshot = await collectionRef('customers')
        .where('assignedSalesRep', '==', assignedSalesRep)
        .where('status', '==', 'activo')
        .get();

      const allowedEmails = new Set(
        customersSnapshot.docs
          .map((doc) => doc.data()?.email)
          .filter((email): email is string => typeof email === 'string' && email.length > 0)
      );

      users = users.filter((u) => allowedEmails.has(u.email));
    }

    requestLogger.end(200);
    return ok(res, { users });
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: `/api/users/role/${role}`,
      method: req.method,
    });
  }
}
