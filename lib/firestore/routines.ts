import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { stripUndefined } from './clean';
import { db } from '../firebase';
import type { Routine } from '../types';

const collectionRef = () => collection(db, 'routines');

export async function getRoutinesForClient(
  clientId: string,
  trainerId?: string
): Promise<Routine[]> {
  // Las pantallas del entrenador pasan trainerId: las reglas de Firestore
  // solo autorizan la consulta si esta demuestra el vinculo (filtro).
  const q = trainerId
    ? query(collectionRef(), where('clientId', '==', clientId), where('trainerId', '==', trainerId))
    : query(collectionRef(), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Routine)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getActiveRoutineForClient(
  clientId: string,
  trainerId?: string
): Promise<Routine | null> {
  const routines = await getRoutinesForClient(clientId, trainerId);
  return routines.find((r) => r.active) ?? null;
}


export async function createRoutine(
  data: Omit<Routine, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = Date.now();
  const ref = await addDoc(collectionRef(), stripUndefined({ ...data, createdAt: now, updatedAt: now }));
  return ref.id;
}

export async function updateRoutine(id: string, data: Partial<Routine>) {
  await updateDoc(doc(db, 'routines', id), stripUndefined({ ...data, updatedAt: Date.now() }));
}


/** Marca esta rutina como activa y desactiva las demás rutinas del cliente. */
export async function setActiveRoutine(
  clientId: string,
  routineId: string,
  trainerId?: string
) {
  const routines = await getRoutinesForClient(clientId, trainerId);
  await Promise.all(
    routines.map((r) => updateDoc(doc(db, 'routines', r.id), { active: r.id === routineId }))
  );
}
