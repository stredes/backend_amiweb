import type { VercelRequest } from '@vercel/node';
import { collectionRef, nowTimestamp } from '../lib/firestore';
import { logger } from '../utils/logger';
import type { AdminAssistantQueryRequest, AdminAssistantQueryResponse } from './types';

export async function writeClawbotAudit(
  req: VercelRequest,
  payload: {
    request: AdminAssistantQueryRequest;
    response: AdminAssistantQueryResponse;
    intent: string;
    filters: Record<string, unknown>;
    durationMs: number;
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
      question: payload.request.question,
      context: payload.request.context,
      intent: payload.intent,
      filters: payload.filters,
      queryLabel: payload.response.queryLabel,
      answer: payload.response.answer,
      rowCount: payload.response.rows.length,
      durationMs: payload.durationMs,
      createdAt: nowTimestamp()
    });
  } catch (error) {
    logger.warn('No se pudo guardar auditoria de assistant query', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
