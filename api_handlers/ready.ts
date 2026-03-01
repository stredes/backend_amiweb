import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ok, fail } from '../src/utils/responses';
import { createRequestLogger } from '../src/middleware/requestLogger';
import { enableCors, handleCorsPreFlight } from '../src/middleware/cors';
import { getFirebaseApp, firestore } from '../src/lib/firebase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestLogger = createRequestLogger(req, res);

  enableCors(req, res);
  if (handleCorsPreFlight(req, res)) {
    return;
  }

  if (req.method !== 'GET') {
    requestLogger.end(405);
    return fail(res, 'Método no permitido', 405);
  }

  try {
    getFirebaseApp();
    // Verifica conectividad básica a Firestore.
    await firestore.collection('_health').limit(1).get();

    requestLogger.end(200);
    return ok(res, {
      status: 'ready',
      timestamp: new Date().toISOString(),
      dependencies: {
        firebaseAdmin: 'ok',
        firestore: 'ok'
      }
    });
  } catch (error) {
    requestLogger.end(503);
    return fail(
      res,
      'Dependencias no listas',
      503,
      {
        dependency: 'firebase/firestore',
        reason: error instanceof Error ? error.message : String(error)
      },
      'DEPENDENCY_NOT_READY'
    );
  }
}
