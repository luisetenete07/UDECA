import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { ProgressPhoto } from '../types';

const collectionRef = () => collection(db, 'progressPhotos');

export async function getProgressPhotosForClient(clientId: string): Promise<ProgressPhoto[]> {
  const q = query(collectionRef(), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as ProgressPhoto)
    .sort((a, b) => b.date - a.date);
}

export async function createProgressPhoto(
  data: Omit<ProgressPhoto, 'id' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collectionRef(), { ...data, createdAt: Date.now() });
  return ref.id;
}

export async function deleteProgressPhoto(id: string) {
  await deleteDoc(doc(db, 'progressPhotos', id));
}
