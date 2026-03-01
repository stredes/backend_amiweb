import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirebaseApp } from '../../src/lib/firebase';
import { nowTimestamp, collectionRef } from '../../src/lib/firestore';
import { requireAuth, requireRole } from '../../src/middleware/auth';
import { ok, fail } from '../../src/utils/responses';
import { handleError } from '../../src/utils/errorHandler';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import { parsePagination } from '../../src/utils/pagination';
import { writeUserAuditLog } from '../../src/utils/auditLog';
import {
  normalizeRole,
  filterUsersForDirectory,
  paginateItems,
  parseOptionalBoolean,
  type DirectoryUser
} from '../../src/utils/userAdminPolicy';
import { createUserAdminSchema, userRoleSchema } from '../../src/validation/userAdminSchema';
import type { UserRole } from '../../src/models/user';

function toDirectoryUser(user: any): DirectoryUser {
  return {
    id: user.uid,
    email: user.email || '',
    name: user.displayName || user.email?.split('@')[0] || 'Usuario',
    role: normalizeRole(user.customClaims?.role) as UserRole,
    phone: user.phoneNumber || undefined,
    isActive: !user.disabled
  };
}

async function listUsersForDashboard() {
  const app = getFirebaseApp();
  const users: any[] = [];
  let nextPageToken: string | undefined;
  let guard = 0;

  do {
    const result = await app.auth().listUsers(1000, nextPageToken);
    users.push(...result.users);
    nextPageToken = result.pageToken;
    guard += 1;
  } while (nextPageToken && guard < 5);

  return users;
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
      const isAuthorized = requireRole(req, res, ['root', 'admin']);
      if (!isAuthorized) {
        requestLogger.end(403);
        return;
      }

      const { page, pageSize } = parsePagination(req.query as Record<string, string>);
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const roleRaw = typeof req.query.role === 'string' ? req.query.role : undefined;
      const isActive = parseOptionalBoolean(req.query.isActive);
      const roleParsed = roleRaw ? userRoleSchema.safeParse(roleRaw) : null;
      const hasIsActiveQuery = typeof req.query.isActive === 'string';

      if (roleRaw && !roleParsed?.success) {
        requestLogger.end(400);
        return fail(res, 'Rol inválido', 400);
      }
      if (hasIsActiveQuery && typeof isActive !== 'boolean') {
        requestLogger.end(400);
        return fail(res, 'isActive debe ser true o false', 400);
      }

      const allUsers = await listUsersForDashboard();
      const mapped = allUsers.map(toDirectoryUser);
      const filtered = filterUsersForDirectory(mapped, {
        role: roleParsed?.success ? roleParsed.data : undefined,
        isActive,
        search
      });

      const pagination = paginateItems(filtered, page, pageSize);

      requestLogger.end(200);
      return ok(res, {
        items: pagination.items,
        users: pagination.items,
        total: pagination.total,
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages: pagination.totalPages
      });
    }

    if (req.method === 'POST') {
      const isAuthorized = requireRole(req, res, ['root']);
      if (!isAuthorized) {
        requestLogger.end(403);
        return;
      }

      const parsed = createUserAdminSchema.safeParse(req.body);
      if (!parsed.success) {
        requestLogger.end(400);
        return fail(res, 'Datos inválidos para crear usuario', 400, parsed.error.errors, 'VALIDATION_ERROR');
      }

      const data = parsed.data;
      const app = getFirebaseApp();
      let userRecord;
      try {
        userRecord = await app.auth().createUser({
          email: data.email,
          password: data.password,
          displayName: data.name,
          phoneNumber: data.phone,
          disabled: false,
          emailVerified: true
        });
      } catch (error) {
        const firebaseCode = (error as any)?.code;
        if (firebaseCode === 'auth/email-already-exists') {
          requestLogger.end(409);
          return fail(res, 'El correo ya está registrado', 409, undefined, 'USER_ALREADY_EXISTS');
        }
        throw error;
      }

      await app.auth().setCustomUserClaims(userRecord.uid, { role: data.role });

      await collectionRef('userProfiles').doc(userRecord.uid).set({
        uid: userRecord.uid,
        email: data.email,
        displayName: data.name,
        role: data.role,
        company: data.company || null,
        department: data.department || null,
        phone: data.phone || null,
        isActive: true,
        createdAt: nowTimestamp(),
        updatedAt: nowTimestamp()
      });

      const user = toDirectoryUser({ ...userRecord, customClaims: { role: data.role } });
      await writeUserAuditLog(req, 'user.created', userRecord.uid, {
        role: data.role,
        email: data.email,
        after: user
      });
      requestLogger.end(201);
      return ok(res, { user }, 201);
    }

    requestLogger.end(405);
    return fail(res, 'Método no permitido', 405);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/users',
      method: req.method
    });
  }
}
