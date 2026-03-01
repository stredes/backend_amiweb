import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirebaseApp } from '../../src/lib/firebase';
import { nowTimestamp, collectionRef } from '../../src/lib/firestore';
import { requireAuth, requireRole } from '../../src/middleware/auth';
import { ok, fail } from '../../src/utils/responses';
import { handleError } from '../../src/utils/errorHandler';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import { writeUserAuditLog } from '../../src/utils/auditLog';
import { normalizeRole } from '../../src/utils/userAdminPolicy';
import { updateUserAdminSchema } from '../../src/validation/userAdminSchema';
import type { UserRole } from '../../src/models/user';

function toPublicUser(user: any, profile?: any) {
  return {
    id: user.uid,
    email: user.email || '',
    name: user.displayName || user.email?.split('@')[0] || 'Usuario',
    role: normalizeRole(user.customClaims?.role) as UserRole,
    phone: user.phoneNumber || profile?.phone,
    company: profile?.company,
    department: profile?.department,
    isActive: !user.disabled
  };
}

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
    const actor = (req as any).user as { uid: string; role?: string };

    if (req.method === 'GET') {
      const isAuthorized = requireRole(req, res, ['root', 'admin']);
      if (!isAuthorized) {
        requestLogger.end(403);
        return;
      }

      const user = await app.auth().getUser(id);
      const profileDoc = await collectionRef('userProfiles').doc(id).get();
      const profile = profileDoc.exists ? profileDoc.data() : {};

      requestLogger.end(200);
      return ok(res, { user: toPublicUser(user, profile) });
    }

    if (req.method === 'PUT') {
      const isAuthorized = requireRole(req, res, ['root']);
      if (!isAuthorized) {
        requestLogger.end(403);
        return;
      }

      const parsed = updateUserAdminSchema.safeParse(req.body);
      if (!parsed.success) {
        requestLogger.end(400);
        return fail(res, 'Datos inválidos para actualizar usuario', 400, parsed.error.errors);
      }

      const updates = parsed.data;
      if (actor.uid === id && updates.role && updates.role !== 'root') {
        requestLogger.end(400);
        return fail(res, 'No puedes remover tu propio rol root', 400);
      }

      const currentUser = await app.auth().getUser(id);
      const authPayload: Record<string, unknown> = {};

      if (updates.name) authPayload.displayName = updates.name;
      if (updates.email) authPayload.email = updates.email;
      if (typeof updates.phone === 'string') authPayload.phoneNumber = updates.phone;

      if (Object.keys(authPayload).length > 0) {
        await app.auth().updateUser(id, authPayload);
      }

      if (updates.role) {
        await app.auth().setCustomUserClaims(id, {
          ...(currentUser.customClaims || {}),
          role: updates.role
        });
      }

      const profileUpdate: Record<string, unknown> = { updatedAt: nowTimestamp() };
      if (typeof updates.name === 'string') profileUpdate.displayName = updates.name;
      if (typeof updates.email === 'string') profileUpdate.email = updates.email;
      if (typeof updates.role === 'string') profileUpdate.role = updates.role;
      if (updates.company !== undefined) profileUpdate.company = updates.company;
      if (updates.phone !== undefined) profileUpdate.phone = updates.phone;
      if (updates.department !== undefined) profileUpdate.department = updates.department;

      await collectionRef('userProfiles').doc(id).set(
        {
          uid: id,
          ...profileUpdate
        },
        { merge: true }
      );

      await writeUserAuditLog(req, 'user.updated', id, {
        fields: Object.keys(updates)
      });

      const updated = await app.auth().getUser(id);
      const profileDoc = await collectionRef('userProfiles').doc(id).get();
      const profile = profileDoc.exists ? profileDoc.data() : {};

      requestLogger.end(200);
      return ok(res, { user: toPublicUser(updated, profile) });
    }

    if (req.method === 'DELETE') {
      const isAuthorized = requireRole(req, res, ['root']);
      if (!isAuthorized) {
        requestLogger.end(403);
        return;
      }

      if (actor.uid === id) {
        requestLogger.end(400);
        return fail(res, 'No puedes eliminar tu propio usuario root', 400);
      }

      const currentUser = await app.auth().getUser(id);
      await app.auth().deleteUser(id);
      await collectionRef('userProfiles').doc(id).delete().catch(() => undefined);

      await writeUserAuditLog(req, 'user.deleted', id, {
        email: currentUser.email,
        role: normalizeRole(currentUser.customClaims?.role)
      });

      requestLogger.end(200);
      return ok(res, { message: 'Usuario eliminado' });
    }

    requestLogger.end(405);
    return fail(res, 'Método no permitido', 405);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: `/api/users/${id}`,
      method: req.method
    });
  }
}
