import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../../src/middleware/auth';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import { handleError } from '../../../src/utils/errorHandler';
import { fail, ok } from '../../../src/utils/responses';
import { runAdminAssistantQuery } from '../../../src/.clawbot/service';
import { writeClawbotAudit } from '../../../src/.clawbot/audit';
import { inferAssistantPlan } from '../../../src/.clawbot/planner';
import { checkAssistantRateLimit } from '../../../src/.clawbot/rateLimit';

const schema = z.object({
  question: z.string().min(3).max(2000),
  context: z.object({
    scope: z.literal('admin'),
    userRole: z.enum(['admin', 'root']),
    page: z.string().max(120).optional(),
    requestedAt: z.string().optional()
  })
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);

  try {
    const isAuthenticated = await requireAuth(req, res);
    if (!isAuthenticated) {
      requestLogger.end(401);
      return;
    }

    const isAuthorized = requireRole(req, res, ['admin', 'root']);
    if (!isAuthorized) {
      requestLogger.end(403);
      return;
    }

    if (req.method !== 'POST') {
      requestLogger.end(405);
      return fail(res, 'Método no permitido', 405);
    }

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      requestLogger.end(400);
      return fail(res, 'Payload invalido para assistant query', 400, parsed.error.errors, 'VALIDATION_ERROR');
    }

    const actor = (req as any).user as { uid: string; role?: string };
    const rateLimit = checkAssistantRateLimit(actor.uid, 20, 60_000);
    if (!rateLimit.allowed) {
      res.setHeader('Retry-After', String(rateLimit.retryAfter));
      requestLogger.end(429);
      return fail(res, 'Rate limit excedido para assistant query', 429, undefined, 'RATE_LIMITED');
    }

    const plan = inferAssistantPlan(parsed.data.question);
    if (!plan) {
      requestLogger.end(400);
      return fail(res, 'Consulta no soportada por assistant', 400, undefined, 'UNSUPPORTED_QUERY');
    }

    const requestId = typeof res.getHeader('x-request-id') === 'string' ? String(res.getHeader('x-request-id')) : undefined;
    const startedAt = Date.now();
    const timeoutMs = 15_000;

    const result = await Promise.race([
      runAdminAssistantQuery(parsed.data, requestId),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('assistant_timeout')), timeoutMs))
    ]);

    if (!result) {
      requestLogger.end(400);
      return fail(res, 'Consulta no soportada por assistant', 400, undefined, 'UNSUPPORTED_QUERY');
    }

    const durationMs = Date.now() - startedAt;
    await writeClawbotAudit(req, {
      request: parsed.data,
      response: result,
      intent: plan.intent,
      filters: plan.filters,
      durationMs
    });

    requestLogger.end(200);
    return ok(res, result);
  } catch (error) {
    if (error instanceof Error && error.message === 'assistant_timeout') {
      requestLogger.end(500);
      return fail(res, 'Assistant query excedio el timeout maximo', 500, undefined, 'INTERNAL_ERROR');
    }
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/admin/assistant/query',
      method: req.method,
      userId: (req as any).user?.uid
    });
  }
}
