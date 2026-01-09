import { z } from 'zod';

// Schemas de enums
export const orderStatusSchema = z.enum([
  'pendiente',
  'confirmado',
  'procesando',
  'enviado',
  'entregado',
  'cancelado'
]);

export const paymentStatusSchema = z.enum([
  'pendiente',
  'parcial',
  'pagado',
  'reembolsado'
]);

export const paymentMethodSchema = z.enum([
  'transferencia',
  'efectivo',
  'cheque',
  'tarjeta',
  'credito_30',
  'credito_60',
  'credito_90'
]);

// Schema para item del pedido
export const orderItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  productCode: z.string().optional(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative().optional(),
  tax: z.number().nonnegative().optional(),
  notes: z.string().optional()
});

// Schema para dirección de envío
export const shippingAddressSchema = z.object({
  street: z.string().min(3),
  city: z.string().min(2),
  state: z.string().min(2),
  zipCode: z.string().min(3),
  country: z.string().min(2).default('Paraguay'),
  phone: z.string().min(6),
  contactName: z.string().min(2)
});

// Schema para crear una orden
export const createOrderSchema = z.object({
  // Información del cliente
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(6),
  organization: z.string().min(2),
  taxId: z.string().optional(),
  
  // Items del pedido
  items: z.array(orderItemSchema).min(1),
  
  // Totales
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  tax: z.number().nonnegative().default(0),
  shippingCost: z.number().nonnegative().default(0),
  total: z.number().positive(),
  
  // Pago
  paymentMethod: paymentMethodSchema.optional(),
  
  // Envío
  shippingAddress: shippingAddressSchema,
  shippingMethod: z.string().optional(),
  
  // Notas
  customerNotes: z.string().optional(),
  internalNotes: z.string().optional()
});

// Schema para actualizar una orden
export const updateOrderSchema = z.object({
  status: orderStatusSchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
  paymentMethod: paymentMethodSchema.optional(),
  trackingNumber: z.string().optional(),
  internalNotes: z.string().optional(),
  confirmDelivery: z.boolean().optional()
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
