export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  origin?: string;
  createdAt?: FirebaseFirestore.Timestamp;
}
