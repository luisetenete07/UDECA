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
import type { Exercise } from '../types';

const collectionRef = () => collection(db, 'exercises');

export async function getExercisesForTrainer(trainerId: string): Promise<Exercise[]> {
  const q = query(collectionRef(), where('trainerId', '==', trainerId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Exercise)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getExercise(id: string): Promise<Exercise | null> {
  const snap = await getDoc(doc(db, 'exercises', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Exercise) : null;
}

export async function createExercise(
  data: Omit<Exercise, 'id' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collectionRef(), { ...data, createdAt: Date.now() });
  return ref.id;
}

export async function updateExercise(id: string, data: Partial<Exercise>) {
  await updateDoc(doc(db, 'exercises', id), data);
}

export async function deleteExercise(id: string) {
  await deleteDoc(doc(db, 'exercises', id));
}
