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
import type { Payment } from '../types';

const col = collection(db, 'payments');

/** Registra un pago cobrado. Devuelve el id. */
export async function createPayment(
  data: Omit<Payment, 'id' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(col, stripUndefined({ ...data, createdAt: Date.now() }));
  return ref.id;
}

/** Todos los pagos del entrenador, del más reciente al más antiguo. */
export async function getPaymentsForTrainer(trainerId: string): Promise<Payment[]> {
  const snap = await getDocs(query(col, where('trainerId', '==', trainerId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Payment, 'id'>) }))
    .sort((a, b) => b.date - a.date);
}

/** Ajusta el importe de un pago registrado (corrección de errores). */
export async function updatePayment(id: string, amountEur: number): Promise<void> {
  await updateDoc(doc(db, 'payments', id), { amountEur });
}

/**
 * Borra del historial TODOS los cobros de un pagador.
 *
 * Existe para el que ya no está: el alumno que se fue hace un año, el pagador
 * suelto de un bono que no va a volver. Sus cobros siguen sumando a los totales
 * históricos y ocupando una ficha en una lista que se mira para saber quién
 * paga AHORA.
 *
 * Borra de uno en uno y no en lote a propósito: son pocos documentos por
 * persona, y si a mitad falla la red se queda lo que se haya borrado, sin dejar
 * la operación a medias de una forma que haya que deshacer. Devuelve cuántos se
 * fueron, para poder decirlo.
 */
export async function deletePaymentsOfPayer(
  trainerId: string,
  clientId: string
): Promise<number> {
  const snap = await getDocs(
    query(col, where('trainerId', '==', trainerId), where('clientId', '==', clientId))
  );
  let borrados = 0;
  for (const d of snap.docs) {
    await deleteDoc(doc(db, 'payments', d.id));
    borrados++;
  }
  return borrados;
}

/** Elimina un pago registrado. */
export async function deletePayment(id: string): Promise<void> {
  await deleteDoc(doc(db, 'payments', id));
}
