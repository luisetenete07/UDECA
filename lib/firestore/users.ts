import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { stripUndefined } from './clean';
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
    // Tolerante a documentos editados a mano sin algún campo.
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
}

export async function updateClientGoal(clientId: string, goal: string) {
  await setDoc(doc(db, 'users', clientId), { goal }, { merge: true });
}

/** Actualiza campos editables del propio perfil (foto, nombre, bio, etc.). */
export async function updateUserProfile(uid: string, data: Partial<UserProfile>) {
  await setDoc(doc(db, 'users', uid), stripUndefined(data), { merge: true });
}

/** El entrenador cambia el estado (activo/pausa/inactivo) de un cliente suyo. */
export async function updateClientStatus(
  clientId: string,
  status: UserProfile['status']
) {
  await setDoc(doc(db, 'users', clientId), { status }, { merge: true });
}

/**
 * El entrenador saca a un alumno de su grupo: elimina el vínculo (trainerId)
 * de su perfil. No borra la cuenta del alumno ni sus datos; simplemente deja
 * de pertenecer a este entrenador y podrá vincularse a otro con un código.
 */
export async function removeClientFromTrainer(clientId: string) {
  await updateDoc(doc(db, 'users', clientId), { trainerId: deleteField() });
}
