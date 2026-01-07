import { VercelRequest, VercelResponse } from '@vercel/node';
import { collectionRef } from '../src/lib/firestore';
import { ok, fail } from '../src/utils/responses';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    // Option A: single document ("default")
    const doc = await collectionRef('pageMetadata').doc('default').get();

    if (!doc.exists) {
      return fail(res, 'Metadata not found', 404);
    }

    // Option B (comentado): usar documentos por sección o idioma.
    // Ejemplo: pageMetadata/{lang}/sections/{sectionId}
    // Esto permitiría soportar múltiples idiomas en el futuro.

    return ok(res, { id: doc.id, ...doc.data() });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('metadata error', error);
    return fail(res, 'Unexpected error', 500);
  }
}
