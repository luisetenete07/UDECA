import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { WeightLog } from '../types';

const collectionRef = () => collection(db, 'weightLogs');

export async function getWeightLogsForClient(clientId: string): Promise<WeightLog[]> {
  const q = query(collectionRef(), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as WeightLog)
    .sort((a, b) => a.date - b.date);
}

export async function createWeightLog(
  data: Omit<WeightLog, 'id' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collectionRef(), { ...data, createdAt: Date.now() });
  return ref.id;
}
