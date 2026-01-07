import type { VercelResponse } from '@vercel/node';
import { fail } from './responses';

interface ErrorLog {
  timestamp: string;
  endpoint: string;
  method: string;
  error: string;
  stack?: string;
  userId?: string;
}

/**
 * Logger estructurado de errores
 */
export function logError(error: unknown, context: Partial<ErrorLog>): void {
  const errorLog: ErrorLog = {
    timestamp: new Date().toISOString(),
    endpoint: context.endpoint || 'unknown',
    method: context.method || 'unknown',
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    userId: context.userId
  };

  // En producción, esto debería ir a un servicio como Sentry
  // eslint-disable-next-line no-console
  console.error('[ERROR]', JSON.stringify(errorLog));
}

/**
 * Manejo centralizado de errores con respuesta consistente
 */
export function handleError(
  error: unknown,
  res: VercelResponse,
  context: Partial<ErrorLog>
): VercelResponse {
  logError(error, context);

  // Errores conocidos vs desconocidos
  if (error instanceof Error) {
    if (error.message.includes('not found')) {
      return fail(res, 'Resource not found', 404);
    }
    if (error.message.includes('permission')) {
      return fail(res, 'Permission denied', 403);
    }
  }

  return fail(res, 'Internal server error', 500);
}
