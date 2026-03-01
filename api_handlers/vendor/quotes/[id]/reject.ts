import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fail } from '../../../../src/utils/responses';
import vendorApproveHandler from '../../../quotes/[id]/vendor-approve';

/**
 * POST /api/vendor/quotes/:id/reject
 * Wrapper del flujo vendor-approve con approved=false
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rejectionReason = req.body?.rejectionReason;
  if (typeof rejectionReason !== 'string' || rejectionReason.trim().length < 3) {
    return fail(res, 'rejectionReason es requerido para rechazar', 400, undefined, 'VALIDATION_ERROR');
  }

  req.body = {
    ...(req.body || {}),
    approved: false
  };
  return vendorApproveHandler(req, res);
}
