import { z } from 'zod';

export const inventoryItemSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(2),
  slug: z.string().min(2),
  categoryId: z.string().min(1),
  brand: z.string().min(1),
  shortDescription: z.string().min(2),
  longDescription: z.string().min(2),
  specs: z.record(z.string(), z.string()).default({}),
  requiresInstallation: z.boolean().default(false),
  isActive: z.boolean().default(true),
  stock: z.number().int().min(0).optional(),
  price: z.number().positive().optional()
});

export const inventoryUploadSchema = z.object({
  products: z.array(inventoryItemSchema),
  overwriteExisting: z.boolean().default(false)
});
