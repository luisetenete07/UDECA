import AsyncStorage from '@react-native-async-storage/async-storage';
import { createWorkoutLog } from './firestore/workoutLogs';
import type { WorkoutLog } from './types';

/**
 * Cola offline de entrenamientos: si al terminar una sesión no hay conexión
 * (o Firestore falla), el entreno se guarda en el dispositivo y se sube solo
 * la siguiente vez que la app abre el entreno o el inicio con conexión.
 * El alumno nunca pierde una sesión por entrenar sin cobertura.
 */
const KEY = 'udeca-pending-workouts';

export type PendingWorkout = Omit<WorkoutLog, 'id' | 'createdAt'>;

async function readQueue(): Promise<PendingWorkout[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingWorkout[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: PendingWorkout[]): Promise<void> {
  try {
    if (items.length === 0) await AsyncStorage.removeItem(KEY);
    else await AsyncStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Si el almacenamiento local falla no hay red de seguridad extra posible.
  }
}

export async function enqueueWorkout(data: PendingWorkout): Promise<void> {
  const queue = await readQueue();
  queue.push(data);
  await writeQueue(queue);
}

/**
 * Intenta subir los entrenos pendientes. Devuelve cuántos se subieron.
 * Los que sigan fallando se conservan para el siguiente intento.
 */
export async function flushPendingWorkouts(): Promise<number> {
  const queue = await readQueue();
  if (queue.length === 0) return 0;
  const remaining: PendingWorkout[] = [];
  let uploaded = 0;
  for (const item of queue) {
    try {
      await createWorkoutLog(item);
      uploaded += 1;
    } catch {
      remaining.push(item);
    }
  }
  await writeQueue(remaining);
  return uploaded;
}
