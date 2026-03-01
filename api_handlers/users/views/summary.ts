import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirebaseApp } from '../../../src/lib/firebase';
import { requireAuth, requireRole } from '../../../src/middleware/auth';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import { handleError } from '../../../src/utils/errorHandler';
import { ok, fail } from '../../../src/utils/responses';
import { normalizeRole } from '../../../src/utils/userAdminPolicy';
import type { UserRole } from '../../../src/models/user';

const ROLES: UserRole[] = ['root', 'admin', 'vendedor', 'bodega', 'callcenter', 'soporte', 'socio', 'cliente'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);

  try {
    const isAuthenticated = await requireAuth(req, res);
    if (!isAuthenticated) {
      requestLogger.end(401);
      return;
    }

    const isAuthorized = requireRole(req, res, ['root', 'admin']);
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

    const byRole = ROLES.reduce(
      (acc, role) => {
        acc[role] = { total: 0, active: 0, inactive: 0 };
        return acc;
      },
      {} as Record<UserRole, { total: number; active: number; inactive: number }>
    );

    list.users.forEach((user) => {
      const role = normalizeRole(user.customClaims?.role);
      byRole[role].total += 1;
      if (user.disabled) {
        byRole[role].inactive += 1;
      } else {
        byRole[role].active += 1;
      }
    });

    requestLogger.end(200);
    return ok(res, {
      total: list.users.length,
      active: list.users.filter((u) => !u.disabled).length,
      inactive: list.users.filter((u) => u.disabled).length,
      byRole
    });
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/users/views/summary',
      method: req.method
    });
  }
}
