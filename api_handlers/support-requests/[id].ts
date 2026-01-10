import { VercelRequest, VercelResponse } from '@vercel/node';
import { docRef, nowTimestamp } from '../../src/lib/firestore';
import { ok, fail } from '../../src/utils/responses';
import { supportStatusSchema } from '../../src/validation/supportRequestSchema';

/**
 * GET /api/support-requests/{id} - Obtener detalle
 * PATCH /api/support-requests/{id} - Actualizar status (body: { status: "pendiente" | "en-proceso" | "resuelto" })
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return fail(res, 'Invalid support request id', 400);
  }

  try {
    if (req.method === 'GET') {
      const doc = await docRef('supportRequests', id).get();
      if (!doc.exists) return fail(res, 'Support request not found', 404);
      return ok(res, { id: doc.id, ...doc.data() });
    }

    if (req.method === 'PATCH') {
      const parsed = supportStatusSchema.safeParse(req.body?.status);
      if (!parsed.success) {
        return fail(res, 'Invalid status', 400);
      }

      const ref = docRef('supportRequests', id);
      await ref.update({ status: parsed.data, updatedAt: nowTimestamp() });
      const updated = await ref.get();

      return ok(res, { id: updated.id, ...updated.data() });
    }

    return fail(res, 'Method not allowed', 405);

  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('support request error', error);
    return fail(res, 'Unexpected error', 500);
  }
}
