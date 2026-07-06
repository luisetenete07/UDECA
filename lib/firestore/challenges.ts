import { addDoc, collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { Challenge } from '../types';

const collectionRef = () => collection(db, 'challenges');

/** El reto activo del entrenador (a lo sumo uno), o null. */
export async function getActiveChallenge(trainerId: string): Promise<Challenge | null> {
  const q = query(collectionRef(), where('trainerId', '==', trainerId), where('active', '==', true));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Challenge);
  if (list.length === 0) return null;
  // Si hubiera varios, el más reciente.
  return list.sort((a, b) => b.createdAt - a.createdAt)[0];
}

export async function createChallenge(
  data: Omit<Challenge, 'id' | 'createdAt' | 'active'>
): Promise<string> {
  const ref = await addDoc(collectionRef(), { ...data, active: true, createdAt: Date.now() });
  return ref.id;
}

export async function endChallenge(id: string) {
  await setDoc(doc(db, 'challenges', id), { active: false }, { merge: true });
}
