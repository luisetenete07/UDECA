import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { WorkoutLog } from '../types';

const collectionRef = () => collection(db, 'workoutLogs');

export async function getWorkoutLogsForClient(clientId: string): Promise<WorkoutLog[]> {
  const q = query(collectionRef(), where('clientId', '==', clientId));
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
