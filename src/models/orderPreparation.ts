import { Timestamp } from 'firebase-admin/firestore';

export type PreparationStatus =
  | 'pendiente'      // Pendiente de asignar
  | 'asignado'       // Asignado a un preparador
  | 'en_preparacion' // En proceso de preparación
  | 'preparado'      // Preparado, listo para despacho
  | 'despachado';    // Despachado

export interface OrderPreparationItem {
  productId: string;
  productName: string;
  quantityOrdered: number;
  quantityPrepared: number;
  notes?: string;
  isPrepared: boolean;
}

export interface OrderPreparation {
  orderId: string;
  orderNumber: string;
  
  // Estado de preparación
  status: PreparationStatus;
  
  // Asignación
  assignedTo?: string;         // UID del preparador
  assignedToName?: string;     // Nombre del preparador
  assignedAt?: Timestamp | any;
  assignedBy?: 'auto' | 'manual'; // Tipo de asignación
  
  // Progreso
  items: OrderPreparationItem[];
  totalItems: number;
  preparedItems: number;
  progress: number;             // Porcentaje 0-100
  
  // Métricas de carga
  estimatedMinutes?: number;    // Tiempo estimado de preparación
  
  // Tiempos
  startedAt?: Timestamp | any;
  completedAt?: Timestamp | any;
  
  // Despacho
  dispatchedBy?: string;        // UID del despachador
  dispatchedByName?: string;    // Nombre del despachador
  dispatchedAt?: Timestamp | any;
  carrier?: string;             // Transportista
  trackingNumber?: string;
  
  // Notas y observaciones
  preparationNotes?: string;
  dispatchNotes?: string;
  
  // Metadata
  createdAt: Timestamp | any;
  updatedAt: Timestamp | any;
}

export interface PreparationStats {
  pending: number;
  assigned: number;
  inProgress: number;
  prepared: number;
  dispatched: number;
  total: number;
}

export interface WarehouseStats {
  ordersToday: number;
  ordersPending: number;
  ordersInProgress: number;
  ordersCompleted: number;
  averagePreparationTime: number; // minutos
}
