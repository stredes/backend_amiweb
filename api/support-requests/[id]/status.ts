import { VercelRequest, VercelResponse } from '@vercel/node';
import { docRef, nowTimestamp } from '../../../src/lib/firestore';
import { ok, fail } from '../../../src/utils/responses';
import { supportStatusSchema } from '../../../src/validation/supportRequestSchema';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return fail(res, 'Invalid support request id', 400);
  }

  if (req.method !== 'PATCH') {
    return fail(res, 'Method not allowed', 405);
  }

  try {
    const parsed = supportStatusSchema.safeParse(req.body?.status);
    if (!parsed.success) {
      return fail(res, 'Invalid status', 400);
    }

    const ref = docRef('supportRequests', id);
    await ref.update({ status: parsed.data, updatedAt: nowTimestamp() });
    const updated = await ref.get();

    return ok(res, { id: updated.id, ...updated.data() });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('support status error', error);
    return fail(res, 'Unexpected error', 500);
  }
}
