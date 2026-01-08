import { z } from 'zod';

export const inventoryItemSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(200, 'El nombre no puede exceder 200 caracteres'),
  slug: z.string().min(2, 'El slug debe tener al menos 2 caracteres').max(200, 'El slug no puede exceder 200 caracteres'),
  categoryId: z.string().min(1, 'El categoryId es requerido'),
  brand: z.string().min(1, 'La marca es requerida').max(100, 'La marca no puede exceder 100 caracteres'),
  shortDescription: z.string().min(2, 'La descripción corta debe tener al menos 2 caracteres').max(500, 'La descripción corta no puede exceder 500 caracteres'),
  longDescription: z.string().min(2, 'La descripción larga debe tener al menos 2 caracteres').max(5000, 'La descripción larga no puede exceder 5000 caracteres'),
  specs: z.record(z.string(), z.string()).default({}),
  requiresInstallation: z.union([z.boolean(), z.string()]).transform(val => {
    if (typeof val === 'string') {
      return val.toLowerCase() === 'true' || val.toLowerCase() === 'si' || val.toLowerCase() === 'yes' || val === '1';
    }
    return Boolean(val);
  }).default(false),
  isActive: z.union([z.boolean(), z.string()]).transform(val => {
    if (typeof val === 'string') {
      return val.toLowerCase() !== 'false' && val.toLowerCase() !== 'no' && val !== '0';
    }
    return Boolean(val);
  }).default(true),
  stock: z.union([z.number(), z.string()]).transform(val => {
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? undefined : Math.floor(parsed);
    }
    return val;
  }).pipe(z.number().int().min(0).optional()).optional(),
  price: z.union([z.number(), z.string()]).transform(val => {
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? undefined : parsed;
    }
    return val;
  }).pipe(z.number().positive().optional()).optional()
});

export const inventoryUploadSchema = z.object({
  products: z.array(inventoryItemSchema),
  overwriteExisting: z.boolean().default(false)
});
