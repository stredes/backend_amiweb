import { VercelResponse } from '@vercel/node';

export function ok<T>(res: VercelResponse, data: T, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

export function fail(res: VercelResponse, message: string, statusCode = 400, errors?: any) {
  const response: any = { success: false, error: message };
  if (errors) {
    response.errors = errors;
  }
  return res.status(statusCode).json(response);
}
