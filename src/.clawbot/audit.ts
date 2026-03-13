import type { VercelRequest } from '@vercel/node';
import { collectionRef, nowTimestamp } from '../lib/firestore';
import { logger } from '../utils/logger';
import type { ClawbotChatRequest, ClawbotChatResponse } from './types';

export async function writeClawbotAudit(
  req: VercelRequest,
  payload: {
    request: ClawbotChatRequest;
    response: ClawbotChatResponse;
    toolCalls: Array<{ tool: string; input: Record<string, unknown> }>;
  }
) {
  try {
    await collectionRef('assistantQueries').add({
      actorId: (req as any).user?.uid || null,
      actorEmail: (req as any).user?.email || null,
      actorRole: (req as any).user?.role || null,
      requestId: (req as any).requestId || null,
      ip: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || null,
      userAgent: req.headers['user-agent'] || null,
      query: payload.request.message,
      sessionId: payload.request.sessionId || null,
      toolCalls: payload.toolCalls,
      answer: payload.response.answer,
      meta: payload.response.meta || {},
      createdAt: nowTimestamp()
    });
  } catch (error) {
    logger.warn('No se pudo guardar auditoria de Clawbot', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
