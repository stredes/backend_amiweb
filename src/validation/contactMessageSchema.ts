import { z } from 'zod';

export const contactMessageSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  message: z.string().min(5),
  origin: z.string().optional()
});
