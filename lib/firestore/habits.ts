import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { stripUndefined } from './clean';
import { db } from '../firebase';
import type { Habit, HabitLog } from '../types';

const habitsRef = () => collection(db, 'habits');
const logsRef = () => collection(db, 'habitLogs');

/** Inicio del día actual (medianoche local). */
export function todayStart(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export async function getHabitsForClient(
  clientId: string,
  trainerId?: string
): Promise<Habit[]> {
  // Las pantallas del entrenador pasan trainerId: las reglas de Firestore
  // solo autorizan la consulta si esta demuestra el vinculo (filtro).
  const q = trainerId
    ? query(habitsRef(), where('clientId', '==', clientId), where('trainerId', '==', trainerId))
    : query(habitsRef(), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Habit)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function createHabit(data: Omit<Habit, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(habitsRef(), stripUndefined({ ...data, createdAt: Date.now() }));
  return ref.id;
}

export async function deleteHabit(id: string) {
  await deleteDoc(doc(db, 'habits', id));
}

/** Registros de hábitos del cliente desde `since` (por defecto, últimos 7 días). */
export async function getHabitLogsForClient(
  clientId: string,
  trainerId?: string,
  since = todayStart() - 6 * 24 * 60 * 60 * 1000
): Promise<HabitLog[]> {
  const q = trainerId
    ? query(logsRef(), where('clientId', '==', clientId), where('trainerId', '==', trainerId))
    : query(logsRef(), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as HabitLog)
    .filter((l) => l.day >= since);
}

/** Marca un hábito como cumplido hoy. */
export async function logHabitToday(
  data: Omit<HabitLog, 'id' | 'createdAt' | 'day'>
): Promise<string> {
  const ref = await addDoc(logsRef(), stripUndefined({ ...data, day: todayStart(), createdAt: Date.now() }));
  return ref.id;
}

/** Desmarca un hábito de hoy (borra su registro). */
export async function unlogHabit(logId: string) {
  await deleteDoc(doc(db, 'habitLogs', logId));
}
