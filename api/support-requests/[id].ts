import { VercelRequest, VercelResponse } from '@vercel/node';
import { docRef } from '../../src/lib/firestore';
import { ok, fail } from '../../src/utils/responses';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return fail(res, 'Invalid support request id', 400);
  }

  if (req.method !== 'GET') {
    return fail(res, 'Method not allowed', 405);
  }

  try {
    const doc = await docRef('supportRequests', id).get();
    if (!doc.exists) return fail(res, 'Support request not found', 404);
    return ok(res, { id: doc.id, ...doc.data() });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('support request id error', error);
    return fail(res, 'Unexpected error', 500);
  }
}
