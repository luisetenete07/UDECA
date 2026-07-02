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
import { db } from '../firebase';
import type { Routine } from '../types';

const collectionRef = () => collection(db, 'routines');

export async function getRoutinesForClient(clientId: string): Promise<Routine[]> {
  const q = query(collectionRef(), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Routine)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getActiveRoutineForClient(clientId: string): Promise<Routine | null> {
  const routines = await getRoutinesForClient(clientId);
  return routines.find((r) => r.active) ?? null;
}

export async function getRoutine(id: string): Promise<Routine | null> {
  const snap = await getDoc(doc(db, 'routines', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Routine) : null;
}

export async function createRoutine(
  data: Omit<Routine, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = Date.now();
  const ref = await addDoc(collectionRef(), { ...data, createdAt: now, updatedAt: now });
  return ref.id;
}

export async function updateRoutine(id: string, data: Partial<Routine>) {
  await updateDoc(doc(db, 'routines', id), { ...data, updatedAt: Date.now() });
}

export async function deleteRoutine(id: string) {
  await deleteDoc(doc(db, 'routines', id));
}

/** Marca esta rutina como activa y desactiva las demás rutinas del cliente. */
export async function setActiveRoutine(clientId: string, routineId: string) {
  const routines = await getRoutinesForClient(clientId);
  await Promise.all(
    routines.map((r) => updateDoc(doc(db, 'routines', r.id), { active: r.id === routineId }))
  );
}
