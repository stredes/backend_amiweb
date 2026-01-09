import admin from 'firebase-admin';
import { env } from '../config/env';
import { logger } from '../utils/logger';

let app: admin.app.App | undefined;

export function getFirebaseApp() {
  if (!app) {
    try {
      logger.debug('Inicializando Firebase Admin SDK');
      
      // IMPORTANT: In Vercel, multiline private keys are stored with \n.
      const privateKey = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

      app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey
        })
      });
      
      logger.info('Firebase Admin SDK inicializado correctamente', {
        projectId: env.FIREBASE_PROJECT_ID
      });
    } catch (error) {
      logger.error('Error al inicializar Firebase Admin SDK', error, {
        projectId: env.FIREBASE_PROJECT_ID
      });
      throw error;
    }
  }

  return app;
}

export const firestore = (() => {
  getFirebaseApp();
  logger.debug('Firestore client obtenido');
  return admin.firestore();
})();

export const FieldValue = admin.firestore.FieldValue;
