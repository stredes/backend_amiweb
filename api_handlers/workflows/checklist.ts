import type { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef } from '../../src/lib/firestore';
import { requireAuth, requireRole } from '../../src/middleware/auth';
import { createRequestLogger } from '../../src/middleware/requestLogger';
import { handleError } from '../../src/utils/errorHandler';
import { ok, fail } from '../../src/utils/responses';
import { evaluateOrderWorkflowChecklist } from '../../src/utils/workflowCycle';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);

  try {
    const isAuthenticated = await requireAuth(req, res);
    if (!isAuthenticated) {
      requestLogger.end(401);
      return;
    }

    const isAuthorized = requireRole(req, res, ['root', 'admin']);
    if (!isAuthorized) {
      requestLogger.end(403);
      return;
    }

    if (req.method !== 'GET') {
      requestLogger.end(405);
      return fail(res, 'Método no permitido', 405);
    }

    const includeHealthy = req.query.includeHealthy === 'true';
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '100', 10), 1), 300);

    const ordersSnapshot = await collectionRef('orders').orderBy('createdAt', 'desc').limit(limit).get();

    const items = await Promise.all(
      ordersSnapshot.docs.map(async (orderDoc) => {
        const orderId = orderDoc.id;
        const order = orderDoc.data() as any;

        const prepDoc = await collectionRef('orderPreparations').doc(orderId).get();
        const prep = prepDoc.exists ? (prepDoc.data() as any) : null;

        let quoteExists = true;
        if (order.quoteId) {
          const quoteDoc = await collectionRef('quotes').doc(order.quoteId).get();
          quoteExists = quoteDoc.exists;
        }

        const checklist = evaluateOrderWorkflowChecklist(
          {
            id: orderId,
            status: order.status,
            paymentStatus: order.paymentStatus,
            items: order.items,
            quoteId: order.quoteId
          },
          prep
            ? {
                status: prep.status,
                progress: prep.progress,
                inspectionStatus: prep.inspectionStatus,
                adminApprovalStatus: prep.adminApprovalStatus
              }
            : null,
          quoteExists
        );

        return {
          orderId,
          orderNumber: order.orderNumber || null,
          status: order.status,
          paymentStatus: order.paymentStatus,
          preparationStatus: prep?.status || null,
          isHealthy: checklist.isHealthy,
          issues: checklist.issues,
          checks: checklist.checks
        };
      })
    );

    const filtered = includeHealthy ? items : items.filter((item) => !item.isHealthy);

    requestLogger.end(200);
    return ok(res, {
      totalAnalyzed: items.length,
      totalIssues: filtered.filter((item) => !item.isHealthy).length,
      items: filtered
    });
  } catch (error) {
    requestLogger.end(500);
    return handleError(error, res, {
      endpoint: '/api/workflows/checklist',
      method: req.method
    });
  }
}
