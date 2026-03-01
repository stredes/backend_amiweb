import type { OrderStatus, PaymentStatus } from '../models/order';
import type { UserRole } from '../models/user';

export type WorkflowPreparationStatus = 'pendiente' | 'asignado' | 'en_preparacion' | 'preparado' | 'despachado';
export type InspectionStatus = 'pending' | 'approved' | 'rejected';
export type AdminApprovalStatus = 'pending' | 'approved' | 'rejected';

export type WorkflowOrderLike = {
  id: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  items?: Array<{ productId: string; quantity: number }>;
  quoteId?: string;
};

export type WorkflowPreparationLike = {
  status: WorkflowPreparationStatus;
  progress?: number;
  inspectionStatus?: InspectionStatus;
  adminApprovalStatus?: AdminApprovalStatus;
};

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pendiente: ['confirmado', 'cancelado'],
  confirmado: ['procesando', 'cancelado'],
  procesando: ['enviado', 'cancelado'],
  enviado: ['entregado'],
  entregado: [],
  cancelado: []
};

export function canTransitionOrderStatus(
  from: OrderStatus,
  to: OrderStatus,
  actorRole: UserRole,
  confirmDelivery = false
): boolean {
  if (!TRANSITIONS[from]?.includes(to)) {
    return false;
  }

  if (to === 'entregado') {
    const isCustomer = actorRole === 'cliente' || actorRole === 'socio';
    return isCustomer && confirmDelivery;
  }

  if (to === 'enviado') {
    return actorRole === 'bodega' || actorRole === 'admin' || actorRole === 'root';
  }

  if (to === 'confirmado' || to === 'cancelado') {
    return actorRole === 'admin' || actorRole === 'root' || actorRole === 'vendedor';
  }

  if (to === 'procesando') {
    return actorRole === 'bodega' || actorRole === 'admin' || actorRole === 'root';
  }

  return true;
}

export type WorkflowChecklistResult = {
  isHealthy: boolean;
  issues: string[];
  checks: Array<{ key: string; ok: boolean; detail: string }>;
};

export function evaluateOrderWorkflowChecklist(
  order: WorkflowOrderLike,
  preparation: WorkflowPreparationLike | null,
  quoteExists: boolean
): WorkflowChecklistResult {
  const checks: WorkflowChecklistResult['checks'] = [];

  const hasItems = Array.isArray(order.items) && order.items.length > 0;
  checks.push({ key: 'order_has_items', ok: hasItems, detail: hasItems ? 'ok' : 'La orden no tiene items' });

  const saleCorrelated = !order.quoteId || quoteExists;
  checks.push({
    key: 'sale_correlation_quote',
    ok: saleCorrelated,
    detail: saleCorrelated ? 'ok' : `La quote ${order.quoteId} no existe`
  });

  const hasPreparation = !!preparation;
  checks.push({
    key: 'inventory_preparation_exists',
    ok: hasPreparation,
    detail: hasPreparation ? 'ok' : 'No hay preparación de bodega asociada'
  });

  if (preparation) {
    const progressOk = typeof preparation.progress !== 'number' || preparation.progress <= 100;
    checks.push({
      key: 'inventory_progress_valid',
      ok: progressOk,
      detail: progressOk ? 'ok' : 'Progreso de preparación inválido (>100)'
    });

    const inspectionOk =
      order.status === 'enviado' || order.status === 'entregado'
        ? preparation.inspectionStatus === 'approved'
        : true;
    checks.push({
      key: 'inspection_validated',
      ok: inspectionOk,
      detail: inspectionOk ? 'ok' : 'Orden enviada sin inspección aprobada'
    });

    const adminApproved =
      order.status === 'enviado' || order.status === 'entregado'
        ? preparation.adminApprovalStatus === 'approved'
        : true;
    checks.push({
      key: 'admin_approval_validated',
      ok: adminApproved,
      detail: adminApproved ? 'ok' : 'Orden enviada sin aprobación admin'
    });

    const dispatchConsistency =
      order.status === 'enviado' || order.status === 'entregado'
        ? preparation.status === 'despachado'
        : true;
    checks.push({
      key: 'dispatch_consistency',
      ok: dispatchConsistency,
      detail: dispatchConsistency ? 'ok' : 'Estado de orden y preparación no correlacionan'
    });
  }

  const paymentClosed = order.status === 'entregado' ? order.paymentStatus === 'pagado' : true;
  checks.push({
    key: 'purchase_payment_closed',
    ok: paymentClosed,
    detail: paymentClosed ? 'ok' : 'Orden entregada sin pago cerrado'
  });

  const issues = checks.filter((check) => !check.ok).map((check) => check.detail);
  return {
    isHealthy: issues.length === 0,
    issues,
    checks
  };
}
