import { firestore, FieldValue } from './firebase';

export { FieldValue };

export const timestamps = {
  createdAt: FieldValue.serverTimestamp(),
  updatedAt: FieldValue.serverTimestamp()
};

export function nowTimestamp() {
  return FieldValue.serverTimestamp();
}

export function collectionRef(path: string) {
  return firestore.collection(path);
}

export function docRef(path: string, id: string) {
  return firestore.collection(path).doc(id);
}
