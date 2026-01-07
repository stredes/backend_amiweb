import { collectionRef } from '../lib/firestore';

/**
 * Genera keywords de búsqueda para un producto
 */
export function generateSearchKeywords(
  name: string,
  brand: string,
  categoryName?: string
): string[] {
  const keywords = new Set<string>();
  
  // Normalizar y agregar palabras del nombre
  const nameWords = name.toLowerCase().split(/\s+/);
  nameWords.forEach(word => {
    if (word.length > 2) {
      keywords.add(word);
      // Agregar prefijos para búsqueda parcial
      for (let i = 3; i <= word.length; i++) {
        keywords.add(word.substring(0, i));
      }
    }
  });

  // Agregar marca normalizada
  const brandLower = brand.toLowerCase();
  keywords.add(brandLower);
  
  // Agregar categoría si existe
  if (categoryName) {
    keywords.add(categoryName.toLowerCase());
  }

  return Array.from(keywords);
}

/**
 * Verifica que una categoría existe
 */
export async function validateCategoryExists(categoryId: string): Promise<boolean> {
  const doc = await collectionRef('categories').doc(categoryId).get();
  return doc.exists && doc.data()?.isActive === true;
}

/**
 * Verifica que un slug es único (excluyendo el propio documento)
 */
export async function validateUniqueSlug(
  slug: string,
  excludeId?: string
): Promise<boolean> {
  const snapshot = await collectionRef('products')
    .where('slug', '==', slug)
    .limit(1)
    .get();

  if (snapshot.empty) return true;
  
  // Si existe, verificar que no sea el mismo documento
  return excludeId ? snapshot.docs[0].id === excludeId : false;
}

/**
 * Obtiene el nombre de una categoría
 */
export async function getCategoryName(categoryId: string): Promise<string | null> {
  const doc = await collectionRef('categories').doc(categoryId).get();
  return doc.exists ? doc.data()?.name || null : null;
}
