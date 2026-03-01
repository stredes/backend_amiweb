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
    isActive: !user.disabled,
    vendorId: null
  };
}

async function loadProfilesByUid(uids: string[]) {
  const docs = await Promise.all(
    uids.map((uid) => collectionRef('userProfiles').doc(uid).get().catch(() => null))
  );
  const map = new Map<string, any>();
  docs.forEach((doc, idx) => {
    if (doc?.exists) map.set(uids[idx], doc.data() || {});
  });
  return map;
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
    const profileMap = await loadProfilesByUid(list.users.map((u) => u.uid));
    let users = list.users
      .map((user) => {
        const base = toDirectoryUser(user);
        const profile = profileMap.get(user.uid) || {};
        return {
          ...base,
          phone: base.phone || profile.phone || undefined,
          company: profile.company || undefined,
          department: profile.department || undefined,
          vendorId: profile.vendorId || null
        } as DirectoryUser;
      })
      .filter((u) => u.role === parsedRole.data);

    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const isActive = parseOptionalBoolean(req.query.isActive);

    users = filterUsersForDirectory(users, {
      role: parsedRole.data,
      search,
      isActive
    });

    const assignedSalesRep = typeof req.query.vendorId === 'string' ? req.query.vendorId : undefined;

    if (parsedRole.data === 'socio' && assignedSalesRep) {
      users = users.filter((u) => u.vendorId === assignedSalesRep);
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
