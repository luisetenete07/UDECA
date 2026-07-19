import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { stripUndefined } from './clean';
import { db } from '../firebase';
import type { TemplateExercise } from '../types';

/**
 * Plantilla maestra de ejercicios de UDECA (colección global). La lee cualquier
 * entrenador para precargar su biblioteca; solo el admin (CEO) puede escribir
 * (lo imponen las reglas de Firestore).
 */
const collectionRef = () => collection(db, 'templateExercises');

export async function getTemplateExercises(): Promise<TemplateExercise[]> {
  const snap = await getDocs(collectionRef());
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as TemplateExercise)
    .sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
        a.name.localeCompare(b.name)
    );
}

export async function createTemplateExercise(
  data: Omit<TemplateExercise, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = Date.now();
  const ref = await addDoc(
    collectionRef(),
    stripUndefined({ ...data, createdAt: now, updatedAt: now })
  );
  return ref.id;
}

export async function updateTemplateExercise(
  id: string,
  data: Partial<Omit<TemplateExercise, 'id' | 'createdAt'>>
): Promise<void> {
  await updateDoc(
    doc(db, 'templateExercises', id),
    stripUndefined({ ...data, updatedAt: Date.now() })
  );
}

export async function deleteTemplateExercise(id: string): Promise<void> {
  await deleteDoc(doc(db, 'templateExercises', id));
}
