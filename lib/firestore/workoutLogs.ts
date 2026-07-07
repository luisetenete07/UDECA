import { addDoc, collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { WorkoutLog } from '../types';

const collectionRef = () => collection(db, 'workoutLogs');

export async function getWorkoutLog(id: string): Promise<WorkoutLog | null> {
  const snap = await getDoc(doc(db, 'workoutLogs', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as WorkoutLog) : null;
}

export async function getWorkoutLogsForClient(
  clientId: string,
  trainerId?: string
): Promise<WorkoutLog[]> {
  // Las pantallas del entrenador pasan trainerId: las reglas de Firestore
  // solo autorizan la consulta si esta demuestra el vinculo (filtro).
  const q = trainerId
    ? query(collectionRef(), where('clientId', '==', clientId), where('trainerId', '==', trainerId))
    : query(collectionRef(), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as WorkoutLog)
    .sort((a, b) => b.date - a.date);
}

export async function getWorkoutLogsForTrainer(trainerId: string): Promise<WorkoutLog[]> {
  const q = query(collectionRef(), where('trainerId', '==', trainerId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as WorkoutLog)
    .sort((a, b) => b.date - a.date);
}

export async function createWorkoutLog(
  data: Omit<WorkoutLog, 'id' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collectionRef(), { ...data, createdAt: Date.now() });
  return ref.id;
}
