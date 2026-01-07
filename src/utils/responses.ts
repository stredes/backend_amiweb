import { VercelResponse } from '@vercel/node';

export function ok<T>(res: VercelResponse, data: T, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

export function fail(res: VercelResponse, message: string, statusCode = 400) {
  return res.status(statusCode).json({ success: false, error: message });
}
