export interface Product {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  categoryName?: string; // Desnormalizado para búsqueda
  brand: string;
  shortDescription: string;
  longDescription: string;
  specs: Record<string, string>;
  searchKeywords: string[]; // Para búsqueda eficiente
  requiresInstallation: boolean;
  isActive: boolean;
  imageUrls?: string[]; // URLs de imágenes
  price?: number; // Precio referencial
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
}
