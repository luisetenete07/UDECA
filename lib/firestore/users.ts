import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore';
import { stripUndefined } from './clean';
import { db } from '../firebase';
import type { UserProfile } from '../types';

/** trainerCodes/{code} -> { trainerId } — colección pública de solo lectura
 * usada para vincular clientes a su entrenador sin exponer datos personales. */
export async function registerTrainerInviteCode(code: string, trainerId: string) {
  await setDoc(doc(db, 'trainerCodes', code), { trainerId }, { merge: true });
}

export interface InviteCodeInfo {
  trainerId: string;
  /** true si el entrenador ha llenado su plan gratuito y no admite más. */
  full: boolean;
}

/**
 * Resuelve un código de invitación. Devuelve además si el entrenador está
 * lleno, porque el alumno se vincula a sí mismo al registrarse y no puede
 * consultar cuántos alumnos tiene ya ese coach (no tiene permiso para verlos).
 * Sin esta marca, un alumno nuevo podría empujar a su entrenador por encima
 * del límite y dejarle fuera de la app sin que él hiciera nada.
 */
export async function getInviteCodeInfo(code: string): Promise<InviteCodeInfo | null> {
  const snap = await getDoc(doc(db, 'trainerCodes', code));
  if (!snap.exists()) return null;
  const data = snap.data();
  const trainerId = (data.trainerId as string) ?? null;
  if (!trainerId) return null;
  return { trainerId, full: data.full === true };
}

export async function getTrainerIdForInviteCode(code: string): Promise<string | null> {
  return (await getInviteCodeInfo(code))?.trainerId ?? null;
}

/**
 * Guarda cuántos alumnos tiene el entrenador y deja marcado en su código
 * público si ya no admite más. Lo llama su propia app al cargar la lista, que
 * es el único sitio donde se pueden contar de verdad.
 */
export async function syncTrainerClientCount(
  trainer: UserProfile,
  count: number,
  full: boolean
): Promise<void> {
  try {
    if (trainer.clientCount !== count) {
      await updateDoc(doc(db, 'users', trainer.uid), { clientCount: count });
    }
    if (trainer.inviteCode) {
      await setDoc(doc(db, 'trainerCodes', trainer.inviteCode), { full }, { merge: true });
    }
  } catch {
    // Es un contador de conveniencia: si falla, no se le estropea nada al coach.
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function getClientsForTrainer(trainerId: string): Promise<UserProfile[]> {
  const snap = await getDocs(clientsQuery(trainerId));
  return mapClients(snap);
}

/**
 * Igual que `getClientsForTrainer` pero en vivo: en cuanto un alumno entra en
 * el grupo (o cambia cualquiera de sus datos) la lista se reenvía sola, sin
 * necesidad de refrescar la pantalla. Devuelve la función para darse de baja.
 */
export function subscribeClientsForTrainer(
  trainerId: string,
  onChange: (clients: UserProfile[]) => void,
  onError?: (error: Error) => void
): () => void {
  return onSnapshot(
    clientsQuery(trainerId),
    (snap) => onChange(mapClients(snap)),
    (error) => onError?.(error)
  );
}

function clientsQuery(trainerId: string) {
  return query(collection(db, 'users'), where('trainerId', '==', trainerId));
}

function mapClients(snap: QuerySnapshot<DocumentData>): UserProfile[] {
  return (
    snap.docs
      .map((d) => d.data() as UserProfile)
      // Tolerante a documentos editados a mano sin algún campo.
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  );
}

export async function updateClientGoal(clientId: string, goal: string) {
  await setDoc(doc(db, 'users', clientId), { goal }, { merge: true });
}

/** Admin UDECA: lista de todos los coaches (para gestionar suscripciones). */
export async function getAllCoaches(): Promise<UserProfile[]> {
  const q = query(collection(db, 'users'), where('role', '==', 'trainer'));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data() as UserProfile)
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
}

/** Admin UDECA: fija el fin de suscripción de un coach (reglas: solo admin). */
export async function setCoachSubscription(coachId: string, untilMs: number) {
  await updateDoc(doc(db, 'users', coachId), {
    subscriptionUntil: untilMs,
    subscriptionPlan: 'annual',
  });
}

/**
 * Admin UDECA: elimina el perfil de un coach de la plataforma (pierde el
 * acceso y desaparece del panel). Su credencial de login en Firebase Auth
 * solo puede borrarla él mismo o el admin desde la consola de Firebase.
 */
export async function deleteCoachAccount(coachId: string) {
  await deleteDoc(doc(db, 'users', coachId));
}

/** Actualiza campos editables del propio perfil (foto, nombre, bio, etc.). */
export async function updateUserProfile(uid: string, data: Partial<UserProfile>) {
  await setDoc(doc(db, 'users', uid), stripUndefined(data), { merge: true });
}

/**
 * Fija (o BORRA) el enlace de pago del entrenador. Con enlace vacío elimina el
 * campo de verdad (deleteField), porque `updateUserProfile` descarta los
 * `undefined` y el enlace antiguo volvería a aparecer al recargar el perfil.
 */
export async function setTrainerPaymentLink(uid: string, link: string) {
  await updateDoc(doc(db, 'users', uid), {
    paymentLink: link ? link : deleteField(),
  });
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

/**
 * El entrenador confirma el cobro: marca "Pagado", fija la próxima renovación y
 * limpia el aviso de "pago declarado" del alumno (todo en una escritura).
 */
export async function registerClientPayment(clientId: string, nextPaymentDate: number) {
  await setDoc(
    doc(db, 'users', clientId),
    { paymentStatus: 'paid', nextPaymentDate, paymentReportedAt: deleteField() },
    { merge: true }
  );
}

/** El alumno declara que ya ha pagado (pendiente de que el coach lo confirme). */
export async function reportClientPayment(clientId: string) {
  await setDoc(doc(db, 'users', clientId), { paymentReportedAt: Date.now() }, { merge: true });
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
