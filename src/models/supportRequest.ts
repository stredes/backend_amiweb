export type SupportServiceType =
  | 'pre_venta'
  | 'demostracion'
  | 'problema_tecnico'
  | 'mantenimiento_preventivo'
  | 'otro';

export type SupportStatus = 'pendiente' | 'en_proceso' | 'resuelto';

export interface SupportRequest {
  id: string;
  serviceType: SupportServiceType;
  clientName: string;
  organization: string;
  email: string;
  phone?: string;
  equipment?: string;
  serialNumber?: string;
  description: string;
  status: SupportStatus;
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
}
