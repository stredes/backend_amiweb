import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  categoryId: z.string().min(1),
  brand: z.string().min(1).max(100),
  shortDescription: z.string().min(10).max(500),
  longDescription: z.string().min(20).max(5000),
  specs: z.record(z.string(), z.string()).default({}),
  requiresInstallation: z.boolean().default(false),
  isActive: z.boolean().optional().default(true),
  imageUrls: z.array(z.string().url()).optional().default([]),
  price: z.number().positive().optional()
});

export const productUpdateSchema = productSchema.partial();
