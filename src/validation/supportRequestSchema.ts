import { z } from 'zod';

export const supportRequestSchema = z.object({
  serviceType: z.enum([
    'pre_venta',
    'demostracion',
    'problema_tecnico',
    'mantenimiento_preventivo',
    'otro'
  ]),
  clientName: z.string().min(2),
  organization: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  equipment: z.string().optional(),
  serialNumber: z.string().optional(),
  description: z.string().min(5)
});

export const supportStatusSchema = z.enum(['pendiente', 'en_proceso', 'resuelto']);
