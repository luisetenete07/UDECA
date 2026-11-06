import {
  deleteField,
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
import type { Course } from '../types';

const collectionRef = () => collection(db, 'courses');

/** Todos los cursos del entrenador (incluidos borradores sin publicar). */
export async function getCoursesForTrainer(trainerId: string): Promise<Course[]> {
  const q = query(collectionRef(), where('trainerId', '==', trainerId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Course)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Cursos publicados de un entrenador (los que ve el alumno).
 * Filtramos `published` en la propia consulta: las reglas de seguridad
 * rechazan cualquier query que pudiera incluir cursos no legibles. */
export async function getPublishedCourses(trainerId: string): Promise<Course[]> {
  const q = query(
    collectionRef(),
    where('trainerId', '==', trainerId),
    where('published', '==', true)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Course)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getCourse(id: string): Promise<Course | null> {
  const snap = await getDoc(doc(db, 'courses', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Course) : null;
}

export async function createCourse(
  data: Omit<Course, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = Date.now();
  const ref = await addDoc(collectionRef(), stripUndefined({ ...data, createdAt: now, updatedAt: now }));
  return ref.id;
}

/**
 * Guarda un curso. Lo que llega como `undefined` a propósito (la portada
 * quitada, la descripción vaciada) se BORRA: `stripUndefined` lo quitaba del
 * envío y `updateDoc` dejaba el valor de antes, así que la portada quitada
 * volvía a salir al abrir el curso.
 */
export async function updateCourse(id: string, data: Partial<Course>) {
  const borrar = (['coverURL', 'description'] as const).filter((k) => k in data && data[k] === undefined);
  await updateDoc(doc(db, 'courses', id), {
    ...stripUndefined({ ...data, updatedAt: Date.now() }),
    ...Object.fromEntries(borrar.map((k) => [k, deleteField()])),
  });
}

export async function deleteCourse(id: string) {
  await deleteDoc(doc(db, 'courses', id));
}
