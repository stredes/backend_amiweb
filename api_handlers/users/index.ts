import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirebaseApp } from '../../src/lib/firebase';
import { nowTimestamp, collectionRef } from '../../src/lib/firestore';
import { requireAuth, requireRole } from '../../src/middleware/auth';
import { ok, fail } from '../../src/utils/responses';
import { handleError } from '../../src/utils/errorHandler';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import type { UserRole } from '../../src/models/user';

const ALLOWED_ROLES: UserRole[] = ['root', 'admin', 'vendedor', 'bodega', 'callcenter', 'soporte', 'socio', 'cliente'];

type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  company?: string;
  phone?: string;
  department?: string;
  isActive: boolean;
};

function toPublicUser(user: any): PublicUser {
  const customRole = (user.customClaims?.role || 'cliente') as UserRole;
  return {
    id: user.uid,
    email: user.email || '',
    name: user.displayName || user.email?.split('@')[0] || 'Usuario',
    role: ALLOWED_ROLES.includes(customRole) ? customRole : 'cliente',
    phone: user.phoneNumber || undefined,
    isActive: !user.disabled,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);

  try {
    const isAuthenticated = await requireAuth(req, res);
    if (!isAuthenticated) {
      requestLogger.end(401);
      return;
    }

    if (req.method === 'GET') {
      const app = getFirebaseApp();
      const list = await app.auth().listUsers(1000);
      const users = list.users.map(toPublicUser);
      requestLogger.end(200);
      return ok(res, { users });
    }

    if (req.method === 'POST') {
      const isAuthorized = requireRole(req, res, ['root']);
      if (!isAuthorized) {
        requestLogger.end(403);
        return;
      }

      const { email, password, name, role, company, phone, department } = (req.body || {}) as {
        email?: string;
        password?: string;
        name?: string;
        role?: UserRole;
        company?: string;
        phone?: string;
        department?: string;
      };

      if (!email || !password || !name || !role) {
        requestLogger.end(400);
        return fail(res, 'email, password, name y role son requeridos', 400);
      }

      if (!ALLOWED_ROLES.includes(role)) {
        requestLogger.end(400);
        return fail(res, 'Rol inválido', 400);
      }

      const app = getFirebaseApp();
      const userRecord = await app.auth().createUser({
        email,
        password,
        displayName: name,
        phoneNumber: phone,
        disabled: false,
        emailVerified: true,
      });

      await app.auth().setCustomUserClaims(userRecord.uid, { role });

      await collectionRef('userProfiles').doc(userRecord.uid).set({
        uid: userRecord.uid,
        email,
        displayName: name,
        role,
        company: company || null,
        department: department || null,
        phone: phone || null,
        isActive: true,
        createdAt: nowTimestamp(),
        updatedAt: nowTimestamp(),
      });

      const user = toPublicUser({ ...userRecord, customClaims: { role } });
      requestLogger.end(201);
      return ok(res, { user }, 201);
    }

    requestLogger.end(405);
    return fail(res, 'Método no permitido', 405);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/users',
      method: req.method,
    });
  }
}
