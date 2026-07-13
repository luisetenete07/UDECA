import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { stripUndefined } from './clean';
import { db } from '../firebase';
import type { LevelTest } from '../types';

const collectionRef = () => collection(db, 'levelTests');

/** Tests de nivel de un alumno (más recientes primero). */
export async function getLevelTestsForClient(
  clientId: string,
  trainerId?: string
): Promise<LevelTest[]> {
  const q = trainerId
    ? query(collectionRef(), where('clientId', '==', clientId), where('trainerId', '==', trainerId))
    : query(collectionRef(), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as LevelTest)
    .sort((a, b) => b.date - a.date);
}

export async function createLevelTest(
  data: Omit<LevelTest, 'id' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collectionRef(), stripUndefined({ ...data, createdAt: Date.now() }));
  return ref.id;
}

export async function deleteLevelTest(id: string): Promise<void> {
  await deleteDoc(doc(db, 'levelTests', id));
}
