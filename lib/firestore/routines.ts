import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { stripUndefined } from './clean';
import { db } from '../firebase';
import type { Routine } from '../types';

const collectionRef = () => collection(db, 'routines');

export async function getRoutinesForClient(
  clientId: string,
  trainerId?: string
): Promise<Routine[]> {
  // Las pantallas del entrenador pasan trainerId: las reglas de Firestore
  // solo autorizan la consulta si esta demuestra el vinculo (filtro).
  const q = trainerId
    ? query(collectionRef(), where('clientId', '==', clientId), where('trainerId', '==', trainerId))
    : query(collectionRef(), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Routine)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getActiveRoutineForClient(
  clientId: string,
  trainerId?: string
): Promise<Routine | null> {
  const routines = await getRoutinesForClient(clientId, trainerId);
  return routines.find((r) => r.active) ?? null;
}

/**
 * La rutina activa de TODOS los alumnos del entrenador, en una sola consulta.
 *
 * La lista de alumnos necesitaba la rutina de cada uno para calcular cuántos
 * entrenos se ha saltado esta semana, y lo hacía pidiéndolas de una en una: con
 * cuarenta alumnos, cuarenta consultas cada vez que se abre la pestaña. En el
 * emulador no se nota y en un móvil con dos rayas de cobertura es la diferencia
 * entre una lista que aparece y una que se queda pensando.
 *
 * Devuelve un mapa por uid de alumno. Si alguien tiene varias activas —no
 * debería, pero los datos viejos existen— se queda la más reciente, igual que
 * hacía `getActiveRoutineForClient`.
 */
export async function getActiveRoutinesForTrainer(
  trainerId: string
): Promise<Record<string, Routine>> {
  const snap = await getDocs(
    query(collectionRef(), where('trainerId', '==', trainerId), where('active', '==', true))
  );
  const porAlumno: Record<string, Routine> = {};
  for (const d of snap.docs) {
    const r = { id: d.id, ...d.data() } as Routine;
    const previa = porAlumno[r.clientId];
    if (!previa || r.updatedAt > previa.updatedAt) porAlumno[r.clientId] = r;
  }
  return porAlumno;
}


export async function createRoutine(
  data: Omit<Routine, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = Date.now();
  const ref = await addDoc(collectionRef(), stripUndefined({ ...data, createdAt: now, updatedAt: now }));
  return ref.id;
}

export async function updateRoutine(id: string, data: Partial<Routine>) {
  await updateDoc(doc(db, 'routines', id), stripUndefined({ ...data, updatedAt: Date.now() }));
}


/** Marca esta rutina como activa y desactiva las demás rutinas del cliente. */
export async function setActiveRoutine(
  clientId: string,
  routineId: string,
  trainerId?: string
) {
  const routines = await getRoutinesForClient(clientId, trainerId);
  await Promise.all(
    routines.map((r) => updateDoc(doc(db, 'routines', r.id), { active: r.id === routineId }))
  );
}
