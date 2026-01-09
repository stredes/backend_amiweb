import { Timestamp } from 'firebase-admin/firestore';

export interface CartItem {
  productId: string;
  productName: string;
  productCode?: string;
  productImage?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  isAvailable: boolean;       // Si el producto está disponible
  maxQuantity?: number;       // Stock disponible
}

export interface Cart {
  userId?: string;            // ID del usuario (si está autenticado)
  sessionId?: string;         // ID de sesión (para usuarios no autenticados)
  
  items: CartItem[];
  
  // Totales
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  
  // Metadata
  createdAt: Timestamp | any;
  updatedAt: Timestamp | any;
  expiresAt?: Timestamp | any;      // Para carritos de sesión no autenticada
}

export interface CartSummary {
  itemCount: number;
  subtotal: number;
  total: number;
}
