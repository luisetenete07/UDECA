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

/** El entrenador clasifica el estado de pago de un cliente suyo. */
export async function updateClientPaymentStatus(
  clientId: string,
  paymentStatus: UserProfile['paymentStatus']
) {
  await setDoc(doc(db, 'users', clientId), { paymentStatus }, { merge: true });
}

/**
 * El entrenador actualiza los datos de cobro de un cliente (estado de pago,
 * cuota mensual y/o fecha de próximo pago). Solo escribe los campos indicados.
 */
export async function updateClientBilling(
  clientId: string,
  data: Pick<UserProfile, 'paymentStatus' | 'monthlyFeeEur' | 'nextPaymentDate'>
) {
  await setDoc(doc(db, 'users', clientId), stripUndefined(data), { merge: true });
}

/** Quita la fecha de próximo pago de un cliente. */
export async function clearClientNextPayment(clientId: string) {
  await updateDoc(doc(db, 'users', clientId), { nextPaymentDate: deleteField() });
}

/** Normaliza un código: mayúsculas, solo A-Z y 0-9 (sin espacios ni símbolos). */
export function normalizeInviteCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * El entrenador fija su propio código de invitación personalizado. Comprueba
 * que esté libre (o que ya sea suyo), reserva el mapeo público código->coach
 * y lo guarda en su perfil. El código anterior sigue funcionando.
 * Lanza un Error legible si el código está en uso por otro entrenador.
 */
export async function setTrainerInviteCode(trainerId: string, rawCode: string) {
  const code = normalizeInviteCode(rawCode);
  if (code.length < 3 || code.length > 16) {
    throw new Error('El código debe tener entre 3 y 16 letras o números.');
  }
  const existing = await getTrainerIdForInviteCode(code);
  if (existing && existing !== trainerId) {
    throw new Error('Ese código ya está en uso. Prueba con otro.');
  }
  await registerTrainerInviteCode(code, trainerId);
  await updateUserProfile(trainerId, { inviteCode: code });
  return code;
}
