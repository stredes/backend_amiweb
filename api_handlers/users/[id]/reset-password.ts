import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirebaseApp } from '../../../src/lib/firebase';
import { requireAuth, requireRole } from '../../../src/middleware/auth';
import { ok, fail } from '../../../src/utils/responses';
import { handleError } from '../../../src/utils/errorHandler';
import { createRequestLogger } from '../../../src/middleware/requestLogger';

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

    if (req.method !== 'POST') {
      requestLogger.end(405);
      return fail(res, 'Método no permitido', 405);
    }

    const { password } = (req.body || {}) as { password?: string };
    if (!password || password.length < 6) {
      requestLogger.end(400);
      return fail(res, 'password es requerido y debe tener al menos 6 caracteres', 400);
    }

    const app = getFirebaseApp();
    await app.auth().updateUser(id, { password });

    requestLogger.end(200);
    return ok(res, { message: 'Contraseña actualizada' });
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: `/api/users/${id}/reset-password`,
      method: req.method,
    });
  }
}
