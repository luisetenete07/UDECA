import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { stripUndefined } from './clean';
import { db } from '../firebase';
import { startOfWeek } from '../stats';
import type { WeeklyCheckIn } from '../types';

const collectionRef = () => collection(db, 'checkIns');

export async function getCheckInsForClient(
  clientId: string,
  trainerId?: string
): Promise<WeeklyCheckIn[]> {
  // Las pantallas del entrenador pasan trainerId: las reglas de Firestore
  // solo autorizan la consulta si esta demuestra el vinculo (filtro).
  const q = trainerId
    ? query(collectionRef(), where('clientId', '==', clientId), where('trainerId', '==', trainerId))
    : query(collectionRef(), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as WeeklyCheckIn)
    .sort((a, b) => b.weekStart - a.weekStart);
}


export async function createCheckIn(
  data: Omit<WeeklyCheckIn, 'id' | 'createdAt' | 'weekStart'>
): Promise<string> {
  const ref = await addDoc(collectionRef(), stripUndefined({
    ...data,
    weekStart: startOfWeek(Date.now()),
    createdAt: Date.now(),
  }));
  return ref.id;
}

/** true si el alumno ya envió el check-in de la semana en curso. */
export function hasCheckInThisWeek(checkIns: WeeklyCheckIn[]): boolean {
  const week = startOfWeek(Date.now());
  return checkIns.some((c) => c.weekStart === week);
}
