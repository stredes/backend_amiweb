import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirebaseApp } from '../lib/firebase';
import { fail } from '../utils/responses';

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
      fail(res, 'No authorization token provided', 401);
      return false;
    }

    const token = authHeader.split('Bearer ')[1];

    if (!token) {
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

    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auth error:', error);
    fail(res, 'Invalid or expired token', 401);
    return false;
  }
}

/**
 * Verifica que el usuario tenga rol admin
 */
export function requireAdmin(req: VercelRequest, res: VercelResponse): boolean {
  if (!(req as any).user) {
    fail(res, 'Not authenticated', 401);
    return false;
  }

  if ((req as any).user.role !== 'admin') {
    fail(res, 'Admin access required', 403);
    return false;
  }

  return true;
}
