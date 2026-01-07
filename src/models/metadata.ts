export interface PageMetadata {
  home: {
    heroTitle: string;
    heroSubtitle: string;
    slogan: string;
    blocks: Array<{ title: string; description: string }>;
  };
  about: {
    paragraphs: string[];
    values: string[];
  };
  contact: {
    address: string;
    phone: string;
    email: string;
  };
  updatedAt?: FirebaseFirestore.Timestamp;
}
