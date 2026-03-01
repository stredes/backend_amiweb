import { z } from 'zod';
import type { UserRole } from '../models/user';

const userRoleValues: [UserRole, ...UserRole[]] = [
  'root',
  'admin',
  'vendedor',
  'bodega',
  'callcenter',
  'soporte',
  'socio',
  'cliente'
];

export const userRoleSchema = z.enum(userRoleValues);

export const createUserAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(120),
  role: userRoleSchema,
  company: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  department: z.string().trim().max(120).optional()
});

export const updateUserAdminSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    email: z.string().email().optional(),
    role: userRoleSchema.optional(),
    company: z.string().trim().max(120).nullable().optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    department: z.string().trim().max(120).nullable().optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar'
  });

export const resetUserPasswordSchema = z.object({
  password: z.string().min(8)
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean()
});
