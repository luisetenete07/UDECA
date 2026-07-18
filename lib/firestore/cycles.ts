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
import type { TrainingCycle } from '../types';

const collectionRef = () => collection(db, 'trainingCycles');

/** Ciclos de un alumno (vista del entrenador: demuestra el vínculo con trainerId). */
export async function getCyclesForClient(
  trainerId: string,
  clientId: string
): Promise<TrainingCycle[]> {
  const q = query(
    collectionRef(),
    where('trainerId', '==', trainerId),
    where('clientId', '==', clientId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as TrainingCycle)
    .sort(sortCycles);
}

/** Todos los ciclos del entrenador (para el calendario del negocio). */
export async function getCyclesForTrainer(trainerId: string): Promise<TrainingCycle[]> {
  const q = query(collectionRef(), where('trainerId', '==', trainerId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TrainingCycle).sort(sortCycles);
}

/** Ciclos del propio alumno (vista del alumno: filtra por su clientId). */
export async function getCyclesForClientSelf(clientId: string): Promise<TrainingCycle[]> {
  const q = query(collectionRef(), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TrainingCycle).sort(sortCycles);
}

/** Orden: más recientes por fecha de inicio arriba; sin fecha, por creación. */
function sortCycles(a: TrainingCycle, b: TrainingCycle): number {
  const av = a.startDate ?? a.createdAt;
  const bv = b.startDate ?? b.createdAt;
  return bv - av;
}

export async function createCycle(
  data: Omit<TrainingCycle, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = Date.now();
  const ref = await addDoc(
    collectionRef(),
    stripUndefined({ ...data, createdAt: now, updatedAt: now })
  );
  return ref.id;
}

export async function updateCycle(
  id: string,
  data: Partial<Omit<TrainingCycle, 'id' | 'trainerId' | 'clientId' | 'createdAt'>>
): Promise<void> {
  await updateDoc(doc(db, 'trainingCycles', id), stripUndefined({ ...data, updatedAt: Date.now() }));
}

/**
 * Borra el contenedor del ciclo. Los entrenos (workoutLogs) NO se tocan: la
 * pertenencia se calcula por fechas, así que el historial queda intacto.
 */
export async function deleteCycle(id: string): Promise<void> {
  await deleteDoc(doc(db, 'trainingCycles', id));
}
