import { z } from 'zod';

const envSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().email(),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  NODE_ENV: z.string().optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables', parsed.error.flatten().fieldErrors);
  throw new Error('Missing or invalid environment variables');
}

export const env = {
  ...parsed.data,
  NODE_ENV: parsed.data.NODE_ENV || 'development'
};
