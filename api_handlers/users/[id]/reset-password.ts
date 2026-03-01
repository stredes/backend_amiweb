import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirebaseApp } from '../../../src/lib/firebase';
import { requireAuth, requireRole } from '../../../src/middleware/auth';
import { ok, fail } from '../../../src/utils/responses';
import { handleError } from '../../../src/utils/errorHandler';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import { resetUserPasswordSchema } from '../../../src/validation/userAdminSchema';
import { writeUserAuditLog } from '../../../src/utils/auditLog';

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

    const parsed = resetUserPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      requestLogger.end(400);
      return fail(res, 'password inválido', 400, parsed.error.errors);
    }

    const app = getFirebaseApp();
    await app.auth().updateUser(id, { password: parsed.data.password });

    await writeUserAuditLog(req, 'user.password_reset', id, {
      before: { password: 'redacted' },
      after: { password: 'redacted' }
    });

    requestLogger.end(200);
    return ok(res, { message: 'Contraseña actualizada' });
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: `/api/users/${id}/reset-password`,
      method: req.method
    });
  }
}
