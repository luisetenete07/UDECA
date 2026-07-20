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

/** Elimina un pago registrado. */
export async function deletePayment(id: string): Promise<void> {
  await deleteDoc(doc(db, 'payments', id));
}
