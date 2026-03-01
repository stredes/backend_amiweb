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
    vendorId: profile?.vendorId || null,
    isActive: !user.disabled
  };
}

function getClientIp(req: VercelRequest): string | null {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0]?.trim() || null;
  }
  return (req.headers['x-real-ip'] as string | undefined) || null;
}

async function ensureVendorExists(vendorId: string) {
  const app = getFirebaseApp();
  try {
    const vendor = await app.auth().getUser(vendorId);
    const role = normalizeRole(vendor.customClaims?.role);
    if (role !== 'vendedor') {
      return { ok: false as const, reason: 'INVALID_ROLE' };
    }
    return { ok: true as const, user: vendor };
  } catch (error) {
    const code = (error as any)?.code;
    if (code === 'auth/user-not-found') {
      return { ok: false as const, reason: 'NOT_FOUND' };
    }
    throw error;
  }
}

async function getUserByIdSafe(userId: string) {
  const app = getFirebaseApp();
  try {
    const user = await app.auth().getUser(userId);
    return { ok: true as const, user };
  } catch (error) {
    const code = (error as any)?.code;
    if (code === 'auth/user-not-found') {
      return { ok: false as const };
    }
    throw error;
  }
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
    const actor = (req as any).user as { uid: string; role?: string; email?: string };

    if (req.method === 'GET') {
      const isAuthorized = requireRole(req, res, ['root', 'admin']);
      if (!isAuthorized) {
        requestLogger.end(403);
        return;
      }

      const userResult = await getUserByIdSafe(id);
      if (!userResult.ok) {
        requestLogger.end(404);
        return fail(res, 'Usuario no encontrado', 404, undefined, 'NOT_FOUND');
      }
      const user = userResult.user;
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

      const currentUserResult = await getUserByIdSafe(id);
      if (!currentUserResult.ok) {
        requestLogger.end(404);
        return fail(res, 'Usuario no encontrado', 404, undefined, 'NOT_FOUND');
      }
      const currentUser = currentUserResult.user;
      const currentProfileDoc = await collectionRef('userProfiles').doc(id).get();
      const currentProfile = currentProfileDoc.exists ? currentProfileDoc.data() : {};
      const beforeUser = toPublicUser(currentUser, currentProfile);
      const currentRole = normalizeRole(currentUser.customClaims?.role);
      const nextRole = updates.role || currentRole;

      // Política de cartera:
      // - socio => vendorId obligatorio y debe ser vendedor válido.
      // - no socio => vendorId se limpia.
      let nextVendorId: string | null = null;
      if (nextRole === 'socio') {
        if (!updates.vendorId && !currentProfile?.vendorId) {
          requestLogger.end(400);
          return fail(
            res,
            'vendorId es obligatorio para usuarios con rol socio',
            400,
            undefined,
            'VALIDATION_ERROR'
          );
        }
        nextVendorId = updates.vendorId !== undefined ? updates.vendorId : currentProfile?.vendorId || null;
        if (!nextVendorId) {
          requestLogger.end(400);
          return fail(
            res,
            'vendorId es obligatorio para usuarios con rol socio',
            400,
            undefined,
            'VALIDATION_ERROR'
          );
        }
        const vendorValidation = await ensureVendorExists(nextVendorId);
        if (!vendorValidation.ok) {
          if (vendorValidation.reason === 'NOT_FOUND') {
            requestLogger.end(404);
            return fail(res, 'Vendedor no encontrado', 404, undefined, 'NOT_FOUND');
          }
          requestLogger.end(400);
          return fail(res, 'vendorId debe pertenecer a un usuario con rol vendedor', 400, undefined, 'VALIDATION_ERROR');
        }
      }

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
      profileUpdate.vendorId = nextRole === 'socio' ? nextVendorId : null;

      // Integridad transaccional: perfil + auditoría en una sola transacción de Firestore.
      const db = collectionRef('userProfiles').firestore;
      const profileRef = collectionRef('userProfiles').doc(id);
      const auditRef = collectionRef('auditLogs').doc();
      const requestId = (req as any).requestId || null;
      const ip = getClientIp(req);
      const userAgent = (req.headers['user-agent'] as string | undefined) || null;
      const actorRole = normalizeRole(actor.role);

      await db.runTransaction(async (tx) => {
        tx.set(
          profileRef,
          {
            uid: id,
            ...profileUpdate
          },
          { merge: true }
        );

        tx.set(auditRef, {
          action: 'user.updated',
          targetType: 'user',
          targetId: id,
          metadata: {
            fields: Object.keys(updates),
            before: beforeUser,
            after: {
              ...beforeUser,
              name: updates.name !== undefined ? updates.name : beforeUser.name,
              email: updates.email !== undefined ? updates.email : beforeUser.email,
              role: nextRole,
              phone: updates.phone !== undefined ? updates.phone : beforeUser.phone,
              company: updates.company !== undefined ? updates.company : beforeUser.company,
              department: updates.department !== undefined ? updates.department : beforeUser.department,
              vendorId: nextRole === 'socio' ? nextVendorId : null
            },
            vendorAssignment: {
              before: beforeUser.vendorId || null,
              after: nextRole === 'socio' ? nextVendorId : null
            }
          },
          actorId: actor?.uid || null,
          actorEmail: actor?.email || null,
          actorRole,
          ip,
          userAgent,
          requestId,
          createdAt: nowTimestamp()
        });
      });

      const updated = await app.auth().getUser(id);
      const profileDoc = await collectionRef('userProfiles').doc(id).get();
      const profile = profileDoc.exists ? profileDoc.data() : {};
      const afterUser = toPublicUser(updated, profile);

      requestLogger.end(200);
      return ok(res, { user: afterUser });
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

      const currentUserResult = await getUserByIdSafe(id);
      if (!currentUserResult.ok) {
        requestLogger.end(404);
        return fail(res, 'Usuario no encontrado', 404, undefined, 'NOT_FOUND');
      }
      const currentUser = currentUserResult.user;
      const currentProfileDoc = await collectionRef('userProfiles').doc(id).get();
      const currentProfile = currentProfileDoc.exists ? currentProfileDoc.data() : {};
      const beforeUser = toPublicUser(currentUser, currentProfile);
      await app.auth().deleteUser(id);
      await collectionRef('userProfiles').doc(id).delete().catch(() => undefined);

      await writeUserAuditLog(req, 'user.deleted', id, {
        email: currentUser.email,
        role: normalizeRole(currentUser.customClaims?.role),
        before: beforeUser
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
