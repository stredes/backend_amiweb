import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirebaseApp } from '../../src/lib/firebase';
import { nowTimestamp, collectionRef } from '../../src/lib/firestore';
import { requireAuth, requireRole } from '../../src/middleware/auth';
import { ok, fail } from '../../src/utils/responses';
import { handleError } from '../../src/utils/errorHandler';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import type { UserRole } from '../../src/models/user';

const ALLOWED_ROLES: UserRole[] = ['root', 'admin', 'vendedor', 'bodega', 'callcenter', 'soporte', 'socio', 'cliente'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);
  const { id } = req.query;

  if (!id || Array.isArray(id)) {
    requestLogger.end(400);
    return fail(res, 'ID inválido', 400);
  }

  try {
    const isAuthenticated = await requireAuth(req, res);
    if (!isAuthenticated) {
      requestLogger.end(401);
      return;
    }

    const app = getFirebaseApp();

    if (req.method === 'PUT') {
      const isAuthorized = requireRole(req, res, ['root']);
      if (!isAuthorized) {
        requestLogger.end(403);
        return;
      }

      const { name, email, password, role, company, phone, department } = (req.body || {}) as {
        name?: string;
        email?: string;
        password?: string;
        role?: UserRole;
        company?: string;
        phone?: string;
        department?: string;
      };

      if (role && !ALLOWED_ROLES.includes(role)) {
        requestLogger.end(400);
        return fail(res, 'Rol inválido', 400);
      }

      const updatePayload: any = {};
      if (name) updatePayload.displayName = name;
      if (email) updatePayload.email = email;
      if (password) updatePayload.password = password;
      if (phone) updatePayload.phoneNumber = phone;

      await app.auth().updateUser(id, updatePayload);
      if (role) {
        await app.auth().setCustomUserClaims(id, { role });
      }

      await collectionRef('userProfiles').doc(id).set({
        uid: id,
        email: email || null,
        displayName: name || null,
        role: role || null,
        company: company || null,
        department: department || null,
        phone: phone || null,
        updatedAt: nowTimestamp(),
      }, { merge: true });

      const updated = await app.auth().getUser(id);

      requestLogger.end(200);
      return ok(res, {
        user: {
          id: updated.uid,
          email: updated.email || '',
          name: updated.displayName || updated.email?.split('@')[0] || 'Usuario',
          role: (updated.customClaims?.role || 'cliente') as UserRole,
          phone: updated.phoneNumber || undefined,
          company,
          department,
          isActive: !updated.disabled,
        }
      });
    }

    if (req.method === 'DELETE') {
      const isAuthorized = requireRole(req, res, ['root']);
      if (!isAuthorized) {
        requestLogger.end(403);
        return;
      }

      await app.auth().deleteUser(id);
      await collectionRef('userProfiles').doc(id).delete().catch(() => undefined);

      requestLogger.end(200);
      return ok(res, { message: 'Usuario eliminado' });
    }

    if (req.method === 'GET') {
      const user = await app.auth().getUser(id);
      const profileDoc = await collectionRef('userProfiles').doc(id).get();
      const profile = profileDoc.exists ? profileDoc.data() : {};

      requestLogger.end(200);
      return ok(res, {
        user: {
          id: user.uid,
          email: user.email || '',
          name: user.displayName || user.email?.split('@')[0] || 'Usuario',
          role: (user.customClaims?.role || 'cliente') as UserRole,
          phone: user.phoneNumber || profile?.phone,
          company: profile?.company,
          department: profile?.department,
          isActive: !user.disabled,
        }
      });
    }

    requestLogger.end(405);
    return fail(res, 'Método no permitido', 405);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: `/api/users/${id}`,
      method: req.method,
    });
  }
}
