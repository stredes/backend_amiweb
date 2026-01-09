import { Timestamp } from 'firebase-admin/firestore';

export type QuoteStatus =
  | 'pendiente'               // Solicitud recibida, esperando revisión del vendedor
  | 'en_revision_vendedor'    // Vendedor está revisando
  | 'aprobado_vendedor'       // Vendedor aprobó, esperando aprobación de admin
  | 'rechazado_vendedor'      // Vendedor rechazó la solicitud
  | 'en_revision_admin'       // Admin está revisando
  | 'aprobado'                // Admin aprobó, puede convertirse en orden
  | 'rechazado'               // Admin rechazó la solicitud
  | 'convertida'              // Convertida en orden
  | 'vencida';                // Cotización venció

export interface QuoteItem {
  productId: string;
  productName: string;
  productCode?: string;
  quantity: number;
  unitPrice?: number;      // Puede estar vacío en solicitud inicial
  subtotal?: number;
  discount?: number;
  notes?: string;
}

export interface Quote {
  quoteNumber: string;        // Número de cotización único
  userId?: string;
  
  // Información del cliente
  customerId?: string;        // ID del cliente en la colección customers
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  organization: string;
  taxId?: string;
  
  // Vendedor asignado
  assignedSalesRep: string;   // UID del vendedor asignado
  assignedSalesRepName?: string;
  
  // Items solicitados
  items: QuoteItem[];
  
  // Totales (completados después de generar cotización)
  subtotal?: number;
  discount?: number;
  tax?: number;
  total?: number;
  
  // Estado
  status: QuoteStatus;
  
  // Validez
  validUntil?: Timestamp;
  
  // Notas
  customerMessage?: string;   // Mensaje del cliente al solicitar
  quoteNotes?: string;        // Notas incluidas en la cotización
  internalNotes?: string;     // Notas internas
  vendorNotes?: string;       // Notas del vendedor
  adminNotes?: string;        // Notas del admin
  rejectionReason?: string;   // Razón del rechazo
  
  // Aprobaciones
  vendorApprovedAt?: Timestamp | any;
  vendorApprovedBy?: string;
  vendorRejectedAt?: Timestamp | any;
  vendorRejectedBy?: string;
  adminApprovedAt?: Timestamp | any;
  adminApprovedBy?: string;
  adminRejectedAt?: Timestamp | any;
  adminRejectedBy?: string;
  
  // Referencias
  orderId?: string;           // ID de la orden si fue convertida
  
  // Metadata
  createdAt: Timestamp | any;
  updatedAt: Timestamp | any;
  sentAt?: Timestamp | any;
  acceptedAt?: Timestamp | any;
  rejectedAt?: Timestamp | any;
  
  // Auditoría
  createdBy?: string;
  updatedBy?: string;
}

export interface QuoteSummary {
  id: string;
  quoteNumber: string;
  customerName: string;
  organization: string;
  status: QuoteStatus;
  createdAt: Timestamp;
  itemCount: number;
  total?: number;
}
