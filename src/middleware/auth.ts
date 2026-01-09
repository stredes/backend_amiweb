import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirebaseApp } from '../lib/firebase';
import { fail } from '../utils/responses';
import { logger } from '../utils/logger';

export interface AuthRequest extends VercelRequest {
  user?: {
    uid: string;
    email?: string;
    role?: string;
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

  if ((req as any).user.role !== 'admin') {
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
