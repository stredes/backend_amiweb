import { VercelResponse } from '@vercel/node';

export function ok<T>(res: VercelResponse, data: T, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

function defaultCodeByStatus(statusCode: number): string {
  if (statusCode === 400) return 'VALIDATION_ERROR';
  if (statusCode === 401) return 'UNAUTHORIZED';
  if (statusCode === 403) return 'FORBIDDEN';
  if (statusCode === 404) return 'NOT_FOUND';
  if (statusCode === 409) return 'CONFLICT';
  if (statusCode >= 500) return 'INTERNAL_ERROR';
  return 'REQUEST_ERROR';
}

function getRequestId(res: VercelResponse): string | undefined {
  const header = res.getHeader('x-request-id');
  if (typeof header === 'string') return header;
  if (Array.isArray(header) && typeof header[0] === 'string') return header[0];
  return undefined;
}

function normalizeDetails(details: unknown, requestId?: string): unknown {
  if (details === undefined && !requestId) return undefined;
  if (details === undefined && requestId) return { requestId };

  if (details && typeof details === 'object' && !Array.isArray(details)) {
    return requestId ? { ...(details as Record<string, unknown>), requestId } : details;
  }

  return requestId ? { payload: details, requestId } : details;
}

export function fail(
  res: VercelResponse,
  message: string,
  statusCode = 400,
  details?: unknown,
  code?: string
) {
  const requestId = getRequestId(res);
  const response: any = {
    success: false,
    error: message,
    code: code || defaultCodeByStatus(statusCode)
  };

  const normalizedDetails = normalizeDetails(details, requestId);
  if (normalizedDetails !== undefined) {
    response.details = normalizedDetails;
  }
  return res.status(statusCode).json(response);
}
