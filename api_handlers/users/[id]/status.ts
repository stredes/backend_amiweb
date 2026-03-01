import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirebaseApp } from '../../../src/lib/firebase';
import { nowTimestamp, collectionRef } from '../../../src/lib/firestore';
import { requireAuth, requireRole } from '../../../src/middleware/auth';
import { ok, fail } from '../../../src/utils/responses';
import { handleError } from '../../../src/utils/errorHandler';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import type { UserRole } from '../../../src/models/user';

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

    const isAuthorized = requireRole(req, res, ['root']);
    if (!isAuthorized) {
      requestLogger.end(403);
      return;
    }

    if (req.method !== 'PATCH') {
      requestLogger.end(405);
      return fail(res, 'Método no permitido', 405);
    }

    const { isActive } = (req.body || {}) as { isActive?: boolean };
    if (typeof isActive !== 'boolean') {
      requestLogger.end(400);
      return fail(res, 'isActive debe ser boolean', 400);
    }

    const app = getFirebaseApp();
    await app.auth().updateUser(id, { disabled: !isActive });
    await collectionRef('userProfiles').doc(id).set({
      isActive,
      updatedAt: nowTimestamp(),
    }, { merge: true });

    const user = await app.auth().getUser(id);

    requestLogger.end(200);
    return ok(res, {
      user: {
        id: user.uid,
        email: user.email || '',
        name: user.displayName || user.email?.split('@')[0] || 'Usuario',
        role: (user.customClaims?.role || 'cliente') as UserRole,
        phone: user.phoneNumber || undefined,
        isActive: !user.disabled,
      }
    });
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: `/api/users/${id}/status`,
      method: req.method,
    });
  }
}
