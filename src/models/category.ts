export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
}
