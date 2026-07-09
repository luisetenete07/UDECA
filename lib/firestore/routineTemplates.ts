import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { stripUndefined } from './clean';
import { db } from '../firebase';
import type { RoutineTemplate } from '../types';

const col = collection(db, 'routineTemplates');

/** Guarda una plantilla de rutina del entrenador. Devuelve el id creado. */
export async function createRoutineTemplate(
  data: Omit<RoutineTemplate, 'id' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(col, stripUndefined({ ...data, createdAt: Date.now() }));
  return ref.id;
}

/** Plantillas del entrenador, de la más reciente a la más antigua. */
export async function getRoutineTemplatesForTrainer(
  trainerId: string
): Promise<RoutineTemplate[]> {
  const snap = await getDocs(query(col, where('trainerId', '==', trainerId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<RoutineTemplate, 'id'>) }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteRoutineTemplate(id: string) {
  await deleteDoc(doc(db, 'routineTemplates', id));
}
