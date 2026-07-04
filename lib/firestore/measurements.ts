import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { BodyMeasurement } from '../types';

const collectionRef = () => collection(db, 'bodyMeasurements');

export async function getMeasurementsForClient(clientId: string): Promise<BodyMeasurement[]> {
  const q = query(collectionRef(), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as BodyMeasurement)
    .sort((a, b) => a.date - b.date);
}

export async function createMeasurement(
  data: Omit<BodyMeasurement, 'id' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collectionRef(), { ...data, createdAt: Date.now() });
  return ref.id;
}
