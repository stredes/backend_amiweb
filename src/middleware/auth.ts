import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirebaseApp } from '../lib/firebase';
import { fail } from '../utils/responses';
import { logger } from '../utils/logger';
import { UserRole, hasPermission } from '../models/user';

export interface AuthRequest extends VercelRequest {
  user?: {
    uid: string;
    email?: string;
    role?: UserRole;
  };
}

/**
 * Middleware de autenticación con Firebase Auth
 * Valida el token Bearer en el header Authorization
 */
export async function requireAuth(req: VercelRequest, res: VercelResponse): Promise<boolean> {
  try {
    const authHeader = (req.headers as any)['authorization'] as string | undefined;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Intento de acceso sin token de autorización', {
        endpoint: req.url,
        ip: req.headers['x-forwarded-for'] || req.headers['x-real-ip']
      });
      fail(res, 'No authorization token provided', 401);
      return false;
    }

    const token = authHeader.split('Bearer ')[1];

    if (!token) {
      logger.warn('Formato de token inválido', { endpoint: req.url });
      fail(res, 'Invalid token format', 401);
      return false;
    }

    const app = getFirebaseApp();
    const decodedToken = await app.auth().verifyIdToken(token);

    (req as any).user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: (decodedToken as any).role || 'user'
    };

    logger.auth('Usuario autenticado exitosamente', decodedToken.uid, true);
    logger.debug('Detalles de autenticación', {
      userId: decodedToken.uid,
      email: decodedToken.email,
      role: (decodedToken as any).role || 'user'
    });

    return true;
  } catch (error) {
    logger.error('Error en autenticación', error, {
      endpoint: req.url,
      errorType: error instanceof Error ? error.name : 'Unknown'
    });
    logger.auth('Fallo de autenticación', undefined, false);
    fail(res, 'Invalid or expired token', 401);
    return false;
  }
}

/**
 * Verifica que el usuario tenga rol admin
 */
export function requireAdmin(req: VercelRequest, res: VercelResponse): boolean {
  if (!(req as any).user) {
    logger.warn('Intento de acceso admin sin autenticación', { endpoint: req.url });
    fail(res, 'Not authenticated', 401);
    return false;
  }

  if ((req as any).user.role !== 'admin' && (req as any).user.role !== 'root') {
    logger.warn('Intento de acceso admin denegado', {
      userId: (req as any).user.uid,
      role: (req as any).user.role,
      endpoint: req.url
    });
    fail(res, 'Admin access required', 403);
    return false;
  }

  logger.debug('Acceso admin concedido', {
    userId: (req as any).user.uid,
    endpoint: req.url
  });

  return true;
}

/**
 * Verifica que el usuario tenga un rol específico
 */
export function requireRole(req: VercelRequest, res: VercelResponse, allowedRoles: UserRole[]): boolean {
  if (!(req as any).user) {
    logger.warn('Intento de acceso sin autenticación', { endpoint: req.url, requiredRoles: allowedRoles });
    fail(res, 'Not authenticated', 401);
    return false;
  }

  const userRole = (req as any).user.role as UserRole;
  
  // Root siempre tiene acceso
  if (userRole === 'root') {
    logger.debug('Acceso root concedido', {
      userId: (req as any).user.uid,
      endpoint: req.url
    });
    return true;
  }

  if (!allowedRoles.includes(userRole)) {
    logger.warn('Acceso denegado por rol', {
      userId: (req as any).user.uid,
      userRole,
      requiredRoles: allowedRoles,
      endpoint: req.url
    });
    fail(res, `Access denied. Required roles: ${allowedRoles.join(', ')}`, 403);
    return false;
  }

  logger.debug('Acceso por rol concedido', {
    userId: (req as any).user.uid,
    role: userRole,
    endpoint: req.url
  });

  return true;
}

/**
 * Verifica que el usuario tenga rol de bodega
 */
export function requireWarehouse(req: VercelRequest, res: VercelResponse): boolean {
  return requireRole(req, res, ['bodega', 'admin']);
}

/**
 * Verifica que el usuario tenga permisos específicos
 */
export function requirePermission(req: VercelRequest, res: VercelResponse, permission: string): boolean {
  if (!(req as any).user) {
    logger.warn('Intento de acceso sin autenticación', { endpoint: req.url, permission });
    fail(res, 'Not authenticated', 401);
    return false;
  }

  const userRole = (req as any).user.role as UserRole;

  if (!hasPermission(userRole, permission)) {
    logger.warn('Acceso denegado por falta de permiso', {
      userId: (req as any).user.uid,
      userRole,
      requiredPermission: permission,
      endpoint: req.url
    });
    fail(res, `Permission denied: ${permission}`, 403);
    return false;
  }

  logger.debug('Acceso por permiso concedido', {
    userId: (req as any).user.uid,
    role: userRole,
    permission,
    endpoint: req.url
  });

  return true;
}
