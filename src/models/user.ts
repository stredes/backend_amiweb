import { Timestamp } from 'firebase-admin/firestore';

export type UserRole = 
  | 'root'          // Super administrador
  | 'admin'         // Administrador general
  | 'vendedor'      // Vendedor / Ejecutivo comercial
  | 'bodega'        // Personal de bodega / Preparador de pedidos
  | 'socio'         // Socio / Cliente premium
  | 'cliente';      // Cliente regular

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  disabled: boolean;
  emailVerified: boolean;
  
  // Información adicional
  phone?: string;
  organization?: string;
  
  // Permisos específicos
  permissions?: string[];
  
  // Metadata
  createdAt: Timestamp | any;
  updatedAt: Timestamp | any;
  lastLoginAt?: Timestamp | any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  phone?: string;
  organization?: string;
}

/**
 * Mapeo de roles a permisos
 */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  root: ['*'], // Todos los permisos
  admin: [
    'orders.read',
    'orders.write',
    'orders.delete',
    'products.read',
    'products.write',
    'products.delete',
    'users.read',
    'users.write',
    'reports.read',
    'warehouse.read'
  ],
  vendedor: [
    'orders.read',
    'orders.write',
    'products.read',
    'quotes.read',
    'quotes.write',
    'customers.read',
    'customers.write'
  ],
  bodega: [
    'orders.read',
    'orders.prepare',
    'orders.ship',
    'products.read',
    'inventory.read',
    'inventory.write'
  ],
  socio: [
    'orders.read',
    'orders.write',
    'products.read',
    'quotes.read',
    'quotes.write'
  ],
  cliente: [
    'orders.read.own',
    'products.read',
    'quotes.read.own',
    'quotes.write'
  ]
};

/**
 * Verifica si un rol tiene un permiso específico
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  
  // Root tiene todos los permisos
  if (permissions.includes('*')) {
    return true;
  }
  
  // Verificar permiso exacto
  if (permissions.includes(permission)) {
    return true;
  }
  
  // Verificar permiso con wildcard (ej: "orders.*" permite "orders.read")
  const wildcardPermission = permission.split('.')[0] + '.*';
  if (permissions.includes(wildcardPermission)) {
    return true;
  }
  
  return false;
}

/**
 * Verifica si un rol puede acceder a un recurso
 */
export function canAccessResource(role: UserRole, resource: string, action: string): boolean {
  return hasPermission(role, `${resource}.${action}`);
}
