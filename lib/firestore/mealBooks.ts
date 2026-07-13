import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { stripUndefined } from './clean';
import { db } from '../firebase';
import type { MealBook } from '../types';

const booksRef = () => collection(db, 'mealBooks');

/**
 * Libretas de comida de un entrenador. Las pantallas del alumno pasan el
 * trainerId de su coach; las del coach pasan su propio uid. Las reglas de
 * Firestore solo autorizan la consulta si demuestra el vínculo (filtro por
 * trainerId), igual que el resto de colecciones del coaching.
 */
export async function getMealBooksForTrainer(trainerId: string): Promise<MealBook[]> {
  const snap = await getDocs(query(booksRef(), where('trainerId', '==', trainerId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as MealBook)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function createMealBook(
  data: Omit<MealBook, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = Date.now();
  const ref = await addDoc(booksRef(), stripUndefined({ ...data, createdAt: now, updatedAt: now }));
  return ref.id;
}

export async function updateMealBook(id: string, data: Partial<MealBook>): Promise<void> {
  await updateDoc(doc(db, 'mealBooks', id), stripUndefined({ ...data, updatedAt: Date.now() }));
}

export async function deleteMealBook(id: string): Promise<void> {
  await deleteDoc(doc(db, 'mealBooks', id));
}
