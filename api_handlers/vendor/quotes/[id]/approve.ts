import type { VercelRequest, VercelResponse } from '@vercel/node';
import vendorApproveHandler from '../../../quotes/[id]/vendor-approve';

/**
 * POST /api/vendor/quotes/:id/approve
 * Wrapper del flujo vendor-approve con approved=true
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  req.body = {
    ...(req.body || {}),
    approved: true
  };
  return vendorApproveHandler(req, res);
}
