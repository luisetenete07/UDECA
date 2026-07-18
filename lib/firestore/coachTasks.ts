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
import type { CoachTask } from '../types';

const collectionRef = () => collection(db, 'coachTasks');

export async function getCoachTasks(trainerId: string): Promise<CoachTask[]> {
  const q = query(collectionRef(), where('trainerId', '==', trainerId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CoachTask);
}

export async function createCoachTask(
  data: Omit<CoachTask, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = Date.now();
  const ref = await addDoc(
    collectionRef(),
    stripUndefined({ ...data, createdAt: now, updatedAt: now })
  );
  return ref.id;
}

export async function updateCoachTask(
  id: string,
  data: Partial<Omit<CoachTask, 'id' | 'trainerId' | 'createdAt'>>
): Promise<void> {
  await updateDoc(doc(db, 'coachTasks', id), stripUndefined({ ...data, updatedAt: Date.now() }));
}

export async function deleteCoachTask(id: string): Promise<void> {
  await deleteDoc(doc(db, 'coachTasks', id));
}
