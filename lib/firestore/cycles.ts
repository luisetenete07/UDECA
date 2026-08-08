import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { stripUndefined } from './clean';
import { db } from '../firebase';
import { buildPlan, type PlanDraft, type PlannedCycle } from '../cyclePlan';
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


/** Borra un ciclo y todo lo que cuelga de él (un plan entero). */
export async function deleteCycles(ids: string[]): Promise<void> {
  // 500 escrituras por lote es el tope de Firestore; un plan de un año no llega,
  // pero el troceo cuesta cuatro líneas y evita un fallo imposible de reproducir.
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + 400)) batch.delete(doc(db, 'trainingCycles', id));
    await batch.commit();
  }
}

/**
 * Crea el plan completo (macro + mesos + micros) en un solo lote.
 *
 * Los ids se generan aquí, antes de escribir, porque un hijo necesita el id de
 * su padre y en un lote no hay forma de leerlo después. En un lote entra todo o
 * no entra nada: nunca queda un macrociclo a medio poblar si se va la conexión.
 */
export async function createCyclePlan(
  trainerId: string,
  clientId: string,
  draft: PlanDraft
): Promise<string> {
  return writePlan(trainerId, clientId, buildPlan(draft));
}

/**
 * Escribe un plan ya calculado. Lo usan el generador de planes y las
 * plantillas: los dos producen la misma lista, así que solo hay un sitio donde
 * se guarda y no puede divergir.
 */
export async function writePlan(
  trainerId: string,
  clientId: string,
  planned: PlannedCycle[]
): Promise<string> {
  const now = Date.now();
  const ids = new Map<string, string>();
  for (const p of planned) ids.set(p.key, doc(collectionRef()).id);

  const batch = writeBatch(db);
  for (const p of planned) {
    const { key, parentKey, ...rest } = p;
    batch.set(
      doc(db, 'trainingCycles', ids.get(key)!),
      stripUndefined({
        ...rest,
        trainerId,
        clientId,
        parentId: parentKey ? ids.get(parentKey) : undefined,
        createdAt: now,
        updatedAt: now,
      })
    );
  }
  await batch.commit();
  return ids.get('macro')!;
}
