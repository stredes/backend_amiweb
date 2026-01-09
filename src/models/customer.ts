import { Timestamp } from 'firebase-admin/firestore';

/**
 * Modelo de Cliente
 * 
 * Representa un cliente en el sistema con su vendedor asignado
 */
export interface Customer {
  id: string;
  userId?: string; // UID de Firebase Auth si está registrado
  email: string;
  name: string;
  phone?: string;
  company?: string;
  rut?: string;
  address?: {
    street: string;
    city: string;
    region: string;
    postalCode?: string;
    country: string;
  };
  
  // Vendedor asignado al cliente
  assignedSalesRep: string; // UID del vendedor asignado
  assignedSalesRepName?: string; // Nombre del vendedor para referencia
  assignedAt?: Timestamp | any;
  
  // Información comercial
  creditLimit?: number;
  paymentTerms?: 'contado' | '30dias' | '60dias' | '90dias';
  discount?: number; // Descuento en porcentaje
  
  // Metadata
  status: 'activo' | 'inactivo' | 'suspendido';
  notes?: string;
  createdAt: Timestamp | any;
  updatedAt: Timestamp | any;
}

/**
 * Datos para crear un cliente
 */
export interface CreateCustomerData {
  email: string;
  name: string;
  phone?: string;
  company?: string;
  rut?: string;
  address?: {
    street: string;
    city: string;
    region: string;
    postalCode?: string;
    country: string;
  };
  assignedSalesRep: string;
  creditLimit?: number;
  paymentTerms?: 'contado' | '30dias' | '60dias' | '90dias';
  discount?: number;
  notes?: string;
}

/**
 * Datos para actualizar un cliente
 */
export interface UpdateCustomerData {
  name?: string;
  phone?: string;
  company?: string;
  rut?: string;
  address?: {
    street: string;
    city: string;
    region: string;
    postalCode?: string;
    country: string;
  };
  assignedSalesRep?: string;
  creditLimit?: number;
  paymentTerms?: 'contado' | '30dias' | '60dias' | '90dias';
  discount?: number;
  status?: 'activo' | 'inactivo' | 'suspendido';
  notes?: string;
}
