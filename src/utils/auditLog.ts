import type { VercelRequest } from '@vercel/node';
import { collectionRef, nowTimestamp } from '../lib/firestore';
import { logger } from './logger';
import type { AuthRequest } from '../middleware/auth';

type AuditEntry = {
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

function getClientIp(req: VercelRequest): string | undefined {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0]?.trim();
  }
  return (req.headers['x-real-ip'] as string | undefined) || undefined;
}

export async function writeAuditLog(req: AuthRequest, entry: AuditEntry): Promise<void> {
  try {
    const actor = req.user;
    await collectionRef('auditLogs').add({
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId || null,
      metadata: entry.metadata || {},
      actorId: actor?.uid || null,
      actorEmail: actor?.email || null,
      actorRole: actor?.role || null,
      ip: getClientIp(req) || null,
      userAgent: req.headers['user-agent'] || null,
      createdAt: nowTimestamp(),
    });
  } catch (error) {
    logger.warn('No se pudo guardar registro de auditoría', {
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function writeUserAuditLog(
  req: AuthRequest,
  action: string,
  targetId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await writeAuditLog(req, {
    action,
    targetType: 'user',
    targetId,
    metadata,
  });
}
