import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { UserProfile } from '../types';

/** trainerCodes/{code} -> { trainerId } — colección pública de solo lectura
 * usada para vincular clientes a su entrenador sin exponer datos personales. */
export async function registerTrainerInviteCode(code: string, trainerId: string) {
  await setDoc(doc(db, 'trainerCodes', code), { trainerId });
}

export async function getTrainerIdForInviteCode(code: string): Promise<string | null> {
  const snap = await getDoc(doc(db, 'trainerCodes', code));
  if (!snap.exists()) return null;
  return (snap.data().trainerId as string) ?? null;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function getClientsForTrainer(trainerId: string): Promise<UserProfile[]> {
  const q = query(collection(db, 'users'), where('trainerId', '==', trainerId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data() as UserProfile)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function updateClientGoal(clientId: string, goal: string) {
  await setDoc(doc(db, 'users', clientId), { goal }, { merge: true });
}
