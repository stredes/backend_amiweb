import { z } from 'zod';

// Schemas de enums
export const quoteStatusSchema = z.enum([
  'pendiente',
  'en_revision_vendedor',
  'aprobado_vendedor',
  'rechazado_vendedor',
  'en_revision_admin',
  'aprobado',
  'rechazado',
  'convertida',
  'vencida'
]);

// Schema para item de cotización
export const quoteItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  productCode: z.string().optional(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative().optional(),
  subtotal: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional(),
  notes: z.string().optional()
});

// Schema para solicitar una cotización
export const createQuoteSchema = z.object({
  // Información del cliente
  customerId: z.string().optional(),
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(6),
  organization: z.string().min(2),
  taxId: z.string().optional(),
  
  // Items solicitados
  items: z.array(quoteItemSchema).min(1),
  
  // Mensaje del cliente
  customerMessage: z.string().optional()
});

// Schema para actualizar una cotización (usado por el vendedor)
export const updateQuoteSchema = z.object({
  // Items con precios
  items: z.array(quoteItemSchema).optional(),
  
  // Totales
  subtotal: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().optional(),
  tax: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
  
  // Estado
  status: quoteStatusSchema.optional(),
  
  // Validez (en días desde hoy)
  validDays: z.number().int().positive().optional(),
  
  // Notas
  quoteNotes: z.string().optional(),
  internalNotes: z.string().optional()
});

// Schema para cambiar el estado de una cotización
export const quoteStatusUpdateSchema = z.object({
  status: quoteStatusSchema
});

// Schema para aprobación/rechazo por vendedor
export const vendorApprovalSchema = z.object({
  approved: z.boolean(),
  notes: z.string().optional(),
  rejectionReason: z.string().optional()
});

// Schema para aprobación/rechazo por admin
export const adminApprovalSchema = z.object({
  approved: z.boolean(),
  notes: z.string().optional(),
  rejectionReason: z.string().optional()
});

// Schema para convertir quote a orden
export const convertToOrderSchema = z.object({
  paymentMethod: z.enum(['efectivo', 'transferencia', 'tarjeta_credito', 'tarjeta_debito', 'cheque']),
  shippingAddress: z.object({
    street: z.string().min(3),
    city: z.string().min(2),
    region: z.string().min(2),
    postalCode: z.string().optional(),
    country: z.string().min(2)
  }),
  shippingMethod: z.enum(['retiro', 'despacho_standard', 'despacho_express']).optional(),
  notes: z.string().optional()
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;
export type VendorApprovalInput = z.infer<typeof vendorApprovalSchema>;
export type AdminApprovalInput = z.infer<typeof adminApprovalSchema>;
export type ConvertToOrderInput = z.infer<typeof convertToOrderSchema>;
