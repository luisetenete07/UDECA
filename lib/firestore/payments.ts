import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
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
