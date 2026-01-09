import { Timestamp } from 'firebase-admin/firestore';

/**
 * Tipos de notificación
 */
export type NotificationType =
  | 'quote_new'              // Nueva solicitud de cotización
  | 'quote_vendor_approved'  // Vendedor aprobó cotización
  | 'quote_vendor_rejected'  // Vendedor rechazó cotización
  | 'quote_admin_approved'   // Admin aprobó cotización
  | 'quote_admin_rejected'   // Admin rechazó cotización
  | 'quote_converted'        // Cotización convertida a orden
  | 'order_new'              // Nueva orden creada
  | 'order_confirmed'        // Orden confirmada
  | 'order_preparing'        // Orden en preparación
  | 'order_ready'            // Orden lista para despacho
  | 'order_dispatched'       // Orden despachada
  | 'order_delivered'        // Orden entregada
  | 'order_cancelled';       // Orden cancelada

/**
 * Modelo de Notificación
 */
export interface Notification {
  id: string;
  
  // Usuario receptor
  userId: string;            // UID del usuario que recibe la notificación
  userRole?: string;         // Rol del usuario para contexto
  
  // Tipo y contenido
  type: NotificationType;
  title: string;
  message: string;
  
  // Entidad relacionada
  relatedEntityType: 'quote' | 'order' | 'customer' | 'product';
  relatedEntityId: string;
  relatedEntityNumber?: string; // Número de cotización/orden para referencia rápida
  
  // Estado
  read: boolean;
  readAt?: Timestamp | any;
  
  // Metadata
  createdAt: Timestamp | any;
  expiresAt?: Timestamp | any; // Opcional: para notificaciones que expiran
  
  // Información adicional
  data?: Record<string, any>; // Datos adicionales específicos del tipo
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  actionUrl?: string;          // URL para acción relacionada
}

/**
 * Datos para crear una notificación
 */
export interface CreateNotificationData {
  userId: string;
  userRole?: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType: 'quote' | 'order' | 'customer' | 'product';
  relatedEntityId: string;
  relatedEntityNumber?: string;
  data?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  actionUrl?: string;
  expiresAt?: Timestamp | any;
}

/**
 * Resumen de notificación para listas
 */
export interface NotificationSummary {
  id: string;
  type: NotificationType;
  title: string;
  read: boolean;
  createdAt: Timestamp;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}
