import { z } from 'zod';

export const categorySchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().min(2),
  isActive: z.boolean().optional().default(true)
});

export const categoryUpdateSchema = categorySchema.partial();
