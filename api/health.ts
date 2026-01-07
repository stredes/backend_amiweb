import { VercelRequest, VercelResponse } from '@vercel/node';
import { env } from '../src/config/env';
import { ok } from '../src/utils/responses';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  return ok(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV === 'production' ? 'prod' : 'dev'
  });
}
