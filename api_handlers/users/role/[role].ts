import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirebaseApp } from '../../../src/lib/firebase';
import { collectionRef } from '../../../src/lib/firestore';
import { requireAuth, requireRole } from '../../../src/middleware/auth';
import { ok, fail } from '../../../src/utils/responses';
import { handleError } from '../../../src/utils/errorHandler';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import { parsePagination } from '../../../src/utils/pagination';
import {
  filterUsersForDirectory,
  normalizeRole,
  paginateItems,
  parseOptionalBoolean,
  type DirectoryUser
} from '../../../src/utils/userAdminPolicy';
import { userRoleSchema } from '../../../src/validation/userAdminSchema';

function toDirectoryUser(user: any): DirectoryUser {
  return {
    id: user.uid,
    email: user.email || '',
    name: user.displayName || user.email?.split('@')[0] || 'Usuario',
    role: normalizeRole(user.customClaims?.role),
    phone: user.phoneNumber || undefined,
    isActive: !user.disabled
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);
  const roleRaw = Array.isArray(req.query.role) ? undefined : req.query.role;
  const parsedRole = userRoleSchema.safeParse(roleRaw);

  if (!parsedRole.success) {
    requestLogger.end(400);
    return fail(res, 'Rol inválido', 400, parsedRole.error.errors, 'VALIDATION_ERROR');
  }

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
    let users = list.users.map(toDirectoryUser).filter((u) => u.role === parsedRole.data);

    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const isActive = parseOptionalBoolean(req.query.isActive);

    users = filterUsersForDirectory(users, {
      role: parsedRole.data,
      search,
      isActive
    });

    const assignedSalesRep = typeof req.query.vendorId === 'string' ? req.query.vendorId : undefined;

    if (parsedRole.data === 'socio' && assignedSalesRep) {
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

    const { page, pageSize } = parsePagination(req.query as Record<string, string>);
    const pagination = paginateItems(users, page, pageSize);

    requestLogger.end(200);
    return ok(res, {
      items: pagination.items,
      users: pagination.items,
      total: pagination.total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: pagination.totalPages
    });
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: `/api/users/role/${parsedRole.data}`,
      method: req.method
    });
  }
}
