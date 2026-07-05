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
  const ref = await addDoc(collectionRef(), { ...data, createdAt: now, updatedAt: now });
  return ref.id;
}

export async function updateCourse(id: string, data: Partial<Course>) {
  await updateDoc(doc(db, 'courses', id), { ...data, updatedAt: Date.now() });
}

export async function deleteCourse(id: string) {
  await deleteDoc(doc(db, 'courses', id));
}
