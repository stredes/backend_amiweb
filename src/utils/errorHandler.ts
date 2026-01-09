import type { VercelResponse } from '@vercel/node';
import { fail } from './responses';
import { logger } from './logger';

interface ErrorContext {
  endpoint?: string;
  method?: string;
  userId?: string;
  [key: string]: any;
}

/**
 * Logger estructurado de errores (legacy wrapper)
 */
export function logError(error: unknown, context: ErrorContext = {}): void {
  logger.error(
    `Error en ${context.endpoint || 'endpoint desconocido'}`,
    error,
    {
      method: context.method,
      userId: context.userId,
      ...context
    }
  );
}

/**
 * Manejo centralizado de errores con respuesta consistente
 */
export function handleError(
  error: unknown,
  res: VercelResponse,
  context: ErrorContext = {}
): VercelResponse {
  logError(error, context);

  // Errores conocidos vs desconocidos
  if (error instanceof Error) {
    if (error.message.includes('not found')) {
      logger.warn('Recurso no encontrado', { endpoint: context.endpoint });
      return fail(res, 'Resource not found', 404);
    }
    if (error.message.includes('permission')) {
      logger.warn('Permiso denegado', { userId: context.userId, endpoint: context.endpoint });
      return fail(res, 'Permission denied', 403);
    }
  }

  return fail(res, 'Internal server error', 500);
}
