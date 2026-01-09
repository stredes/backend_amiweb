import { Timestamp } from 'firebase-admin/firestore';

export type OrderStatus = 
  | 'pendiente'       // Pedido creado, esperando confirmación
  | 'confirmado'      // Confirmado por el vendedor
  | 'procesando'      // En preparación
  | 'enviado'         // Enviado al cliente
  | 'entregado'       // Entregado al cliente
  | 'cancelado';      // Cancelado

export type PaymentStatus =
  | 'pendiente'       // Pago pendiente
  | 'parcial'         // Pago parcial recibido
  | 'pagado'          // Pagado completamente
  | 'reembolsado';    // Reembolsado

export type PaymentMethod =
  | 'transferencia'
  | 'efectivo'
  | 'cheque'
  | 'tarjeta'
  | 'credito_30'
  | 'credito_60'
  | 'credito_90';

export interface OrderItem {
  productId: string;
  productName: string;
  productCode?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discount?: number;
  tax?: number;
  notes?: string;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
  contactName: string;
}

export interface Order {
  orderNumber: string;           // Número de orden único
  userId?: string;                // ID del usuario (si está autenticado)
  
  // Información del cliente
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  organization: string;
  taxId?: string;                 // RUC/CUIT/NIF
  
  // Items del pedido
  items: OrderItem[];
  
  // Totales
  subtotal: number;
  discount: number;
  tax: number;
  shippingCost: number;
  total: number;
  
  // Estado y pago
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  
  // Envío
  shippingAddress: ShippingAddress;
  shippingMethod?: string;
  trackingNumber?: string;
  
  // Notas y comunicación
  customerNotes?: string;
  internalNotes?: string;
  
  // Metadata
  createdAt: Timestamp | any;
  updatedAt: Timestamp | any;
  confirmedAt?: Timestamp | any;
  shippedAt?: Timestamp | any;
  deliveredAt?: Timestamp | any;
  deliveryConfirmedAt?: Timestamp | any;
  cancelledAt?: Timestamp | any;
  
  // Auditoría
  createdBy?: string;
  updatedBy?: string;
  updateOrigin?: string;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  customerName: string;
  organization: string;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: Timestamp;
  itemCount: number;
}
