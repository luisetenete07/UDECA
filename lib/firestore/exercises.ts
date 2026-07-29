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
import type { Exercise } from '../types';

const collectionRef = () => collection(db, 'exercises');

export async function getExercisesForTrainer(trainerId: string): Promise<Exercise[]> {
  const q = query(collectionRef(), where('trainerId', '==', trainerId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Exercise)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Caché de la biblioteca por entrenador.
 *
 * `getExercisesForTrainer` lee la colección ENTERA (una lectura facturada por
 * ejercicio). Se llamaba en cada visita a Entreno y a Progreso, así que un
 * alumno de un coach con 200 ejercicios gastaba 400 lecturas cada vez que
 * abría la app. Con 50 alumnos entrando dos veces al día eso son ~40.000
 * lecturas diarias solo para pintar unos vídeos y unas etiquetas.
 *
 * La biblioteca casi nunca cambia (solo cuando el coach la edita), así que se
 * guarda en memoria con caducidad corta y se invalida en cuanto alguien
 * escribe. Lo peor que puede pasar es ver un ejercicio recién creado unos
 * minutos tarde en una pantalla que solo lo consulta.
 */
const libraryCache = new Map<string, { at: number; data: Exercise[] }>();
const LIBRARY_TTL_MS = 5 * 60_000;

/**
 * Biblioteca del entrenador, servida de caché si está fresca.
 * Usa esto en pantallas que solo CONSULTAN; para editar, pide `force`.
 */
export async function getExerciseLibrary(
  trainerId: string,
  opts?: { force?: boolean }
): Promise<Exercise[]> {
  const hit = libraryCache.get(trainerId);
  if (!opts?.force && hit && Date.now() - hit.at < LIBRARY_TTL_MS) return hit.data;
  const data = await getExercisesForTrainer(trainerId);
  libraryCache.set(trainerId, { at: Date.now(), data });
  return data;
}

/**
 * Tira la caché. Se llama sola en cada escritura: `updateExercise` y
 * `deleteExercise` solo reciben el id, no saben de quién es el ejercicio, así
 * que se invalida entera. Es barato y evita servir datos viejos por error.
 */
export function invalidateExerciseLibrary(): void {
  libraryCache.clear();
}

export async function getExercise(id: string): Promise<Exercise | null> {
  const snap = await getDoc(doc(db, 'exercises', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Exercise) : null;
}

export async function createExercise(
  data: Omit<Exercise, 'id' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collectionRef(), stripUndefined({ ...data, createdAt: Date.now() }));
  invalidateExerciseLibrary();
  return ref.id;
}

export async function updateExercise(id: string, data: Partial<Exercise>) {
  await updateDoc(doc(db, 'exercises', id), stripUndefined(data));
  invalidateExerciseLibrary();
}

export async function deleteExercise(id: string) {
  await deleteDoc(doc(db, 'exercises', id));
  invalidateExerciseLibrary();
}
