import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../src/middleware/auth';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import { handleError } from '../../src/utils/errorHandler';
import { fail, ok } from '../../src/utils/responses';
import { runClawbotAdminQuery } from '../../src/.clawbot/service';
import { writeClawbotAudit } from '../../src/.clawbot/audit';

const schema = z.object({
  message: z.string().min(3).max(2000),
  sessionId: z.string().trim().min(1).max(120).optional()
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
      return fail(res, 'Payload invalido para assistant chat', 400, parsed.error.errors, 'VALIDATION_ERROR');
    }

    const requestId = typeof res.getHeader('x-request-id') === 'string' ? String(res.getHeader('x-request-id')) : undefined;
    const result = await runClawbotAdminQuery(parsed.data, requestId);
    await writeClawbotAudit(req, {
      request: parsed.data,
      response: result,
      toolCalls: result.toolCalls
    });

    requestLogger.end(200);
    return ok(res, result);
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/assistant/chat',
      method: req.method,
      userId: (req as any).user?.uid
    });
  }
}
