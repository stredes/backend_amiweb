import { z } from 'zod';

// Schema para item del carrito
export const cartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().max(9999)
});

// Schema para agregar un item al carrito
export const addToCartSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().default(1)
});

// Schema para actualizar cantidad de un item
export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive().max(9999)
});

// Schema para actualizar múltiples items
export const updateCartSchema = z.object({
  items: z.array(cartItemSchema)
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type UpdateCartInput = z.infer<typeof updateCartSchema>;
