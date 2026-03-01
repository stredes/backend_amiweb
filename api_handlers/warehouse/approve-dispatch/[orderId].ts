import type { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef, nowTimestamp } from '../../../src/lib/firestore';
import { requireAuth, requireRole } from '../../../src/middleware/auth';
import { createRequestLogger } from '../../../src/middleware/requestLogger';
import { handleError } from '../../../src/utils/errorHandler';
import { ok, fail } from '../../../src/utils/responses';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);
  const { orderId } = req.query;

  if (!orderId || Array.isArray(orderId)) {
    requestLogger.end(400);
    return fail(res, 'ID de orden inválido', 400);
  }

  try {
    const isAuthenticated = await requireAuth(req, res);
    if (!isAuthenticated) {
      requestLogger.end(401);
      return;
    }

    const isAuthorized = requireRole(req, res, ['admin', 'root']);
    if (!isAuthorized) {
      requestLogger.end(403);
      return;
    }

    if (req.method !== 'POST') {
      requestLogger.end(405);
      return fail(res, 'Método no permitido', 405);
    }

    const { approved, notes } = (req.body || {}) as { approved?: boolean; notes?: string };
    if (typeof approved !== 'boolean') {
      requestLogger.end(400);
      return fail(res, 'approved debe ser boolean', 400);
    }

    const prepRef = collectionRef('orderPreparations').doc(orderId);
    const prepDoc = await prepRef.get();
    if (!prepDoc.exists) {
      requestLogger.end(404);
      return fail(res, 'Preparación no encontrada', 404);
    }

    const prep = prepDoc.data() as any;
    if (prep.status !== 'preparado') {
      requestLogger.end(400);
      return fail(res, 'Solo se puede aprobar despacho en estado preparado', 400);
    }

    if (prep.inspectionStatus !== 'approved') {
      requestLogger.end(400);
      return fail(res, 'Se requiere inspección aprobada antes de aprobación admin', 400);
    }

    const actor = (req as any).user as { uid: string };
    await prepRef.update({
      adminApprovalStatus: approved ? 'approved' : 'rejected',
      adminApprovalNotes: notes || null,
      adminApprovedBy: actor.uid,
      adminApprovedAt: nowTimestamp(),
      updatedAt: nowTimestamp()
    });

    const updated = await prepRef.get();

    requestLogger.end(200);
    return ok(res, {
      preparation: { id: updated.id, ...updated.data() },
      message: approved ? 'Despacho aprobado por admin' : 'Despacho rechazado por admin'
    });
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: `/api/warehouse/approve-dispatch/${orderId}`,
      method: req.method
    });
  }
}
