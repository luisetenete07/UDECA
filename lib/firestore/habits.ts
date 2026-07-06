import { addDoc, collection, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
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

export async function getHabitsForClient(clientId: string): Promise<Habit[]> {
  const q = query(habitsRef(), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Habit)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function createHabit(data: Omit<Habit, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(habitsRef(), { ...data, createdAt: Date.now() });
  return ref.id;
}

export async function deleteHabit(id: string) {
  await deleteDoc(doc(db, 'habits', id));
}

/** Registros de hábitos del cliente desde `since` (por defecto, últimos 7 días). */
export async function getHabitLogsForClient(
  clientId: string,
  since = todayStart() - 6 * 24 * 60 * 60 * 1000
): Promise<HabitLog[]> {
  const q = query(logsRef(), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as HabitLog)
    .filter((l) => l.day >= since);
}

/** Marca un hábito como cumplido hoy. */
export async function logHabitToday(
  data: Omit<HabitLog, 'id' | 'createdAt' | 'day'>
): Promise<string> {
  const ref = await addDoc(logsRef(), { ...data, day: todayStart(), createdAt: Date.now() });
  return ref.id;
}

/** Desmarca un hábito de hoy (borra su registro). */
export async function unlogHabit(logId: string) {
  await deleteDoc(doc(db, 'habitLogs', logId));
}
