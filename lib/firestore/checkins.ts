import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { startOfWeek } from '../stats';
import type { WeeklyCheckIn } from '../types';

const collectionRef = () => collection(db, 'checkIns');

export async function getCheckInsForClient(clientId: string): Promise<WeeklyCheckIn[]> {
  const q = query(collectionRef(), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as WeeklyCheckIn)
    .sort((a, b) => b.weekStart - a.weekStart);
}

export async function createCheckIn(
  data: Omit<WeeklyCheckIn, 'id' | 'createdAt' | 'weekStart'>
): Promise<string> {
  const ref = await addDoc(collectionRef(), {
    ...data,
    weekStart: startOfWeek(Date.now()),
    createdAt: Date.now(),
  });
  return ref.id;
}

/** true si el alumno ya envió el check-in de la semana en curso. */
export function hasCheckInThisWeek(checkIns: WeeklyCheckIn[]): boolean {
  const week = startOfWeek(Date.now());
  return checkIns.some((c) => c.weekStart === week);
}
