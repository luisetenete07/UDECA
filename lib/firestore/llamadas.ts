import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  AJUSTES_POR_DEFECTO,
  idDeLlamada,
  type AjustesLlamadas,
  type Llamada,
} from '../llamadas';

/*
 * Las llamadas 1:1 en Firestore (la lógica, en lib/llamadas.ts).
 *
 *  - `llamadasCoach/{trainerId}`: la disponibilidad y los planes del
 *    entrenador. La leen él y sus alumnos.
 *  - `llamadas/{trainerId}_{inicio}`: cada llamada reservada. El id ES la hora:
 *    dos alumnos que reservan el mismo hueco a la vez escriben el mismo
 *    documento, y las reglas solo dejan crearlo, no pisarlo. El segundo recibe
 *    un "esa hora acaba de cogerse" en vez de una llamada doble.
 *  - El plan de cada alumno, en su perfil (`planId`), que solo pone el
 *    entrenador.
 *
 * Cancelar es borrar: el hueco vuelve a quedar libre y la llamada deja de
 * contar en el cupo del mes.
 */

export async function getAjustesLlamadas(trainerId: string): Promise<AjustesLlamadas> {
  const snap = await getDoc(doc(db, 'llamadasCoach', trainerId));
  const d = snap.exists() ? (snap.data() as Partial<AjustesLlamadas>) : {};
  return {
    ...AJUSTES_POR_DEFECTO,
    ...d,
    sinPlan: { ...AJUSTES_POR_DEFECTO.sinPlan, ...(d.sinPlan ?? {}) },
    franjas: d.franjas ?? [],
    planes: d.planes ?? [],
    trainerId,
  };
}

export async function guardarAjustesLlamadas(a: AjustesLlamadas): Promise<void> {
  const limpio: Record<string, unknown> = { ...a, updatedAt: Date.now() };
  if (!a.enlace) delete limpio.enlace;
  if (!a.zona) delete limpio.zona;
  await setDoc(doc(db, 'llamadasCoach', a.trainerId), limpio);
}

const deLlamada = (id: string, d: Record<string, unknown>): Llamada => ({
  id,
  trainerId: String(d.trainerId),
  clientId: String(d.clientId),
  inicio: Number(d.inicio),
  fin: Number(d.fin),
  createdAt: Number(d.createdAt ?? 0),
});

/** Las llamadas del entrenador entre dos instantes (las de todos sus alumnos). */
export async function getLlamadasEntre(trainerId: string, desde: number, hasta: number): Promise<Llamada[]> {
  const snap = await getDocs(
    query(
      collection(db, 'llamadas'),
      where('trainerId', '==', trainerId),
      where('inicio', '>=', desde),
      where('inicio', '<', hasta)
    )
  );
  return snap.docs.map((x) => deLlamada(x.id, x.data())).sort((a, b) => a.inicio - b.inicio);
}

/** Las de un alumno con su entrenador. */
export async function getLlamadasDelAlumno(clientId: string, trainerId: string): Promise<Llamada[]> {
  const snap = await getDocs(
    query(collection(db, 'llamadas'), where('clientId', '==', clientId), where('trainerId', '==', trainerId))
  );
  return snap.docs.map((x) => deLlamada(x.id, x.data())).sort((a, b) => a.inicio - b.inicio);
}

/**
 * Reserva. Si el hueco lo acaba de coger otro, Firestore lo rechaza (las
 * reglas no dejan pisar una llamada) y se lanza 'ocupada'.
 */
export async function reservarLlamada(l: Omit<Llamada, 'id' | 'createdAt'>): Promise<Llamada> {
  const id = idDeLlamada(l.trainerId, l.inicio);
  const datos = { ...l, createdAt: Date.now() };
  try {
    await setDoc(doc(db, 'llamadas', id), datos);
  } catch (e) {
    const code = (e as { code?: string })?.code;
    throw new Error(code === 'permission-denied' ? 'ocupada' : 'error');
  }
  return { id, ...datos };
}

export async function cancelarLlamada(id: string): Promise<void> {
  await deleteDoc(doc(db, 'llamadas', id));
}

/**
 * El plan de un alumno. Si el plan incluye lo VIP, el alumno pasa a VIP (y
 * deja de serlo si el nuevo no lo incluye): así "VIP" es una ventaja del plan
 * y no una casilla aparte que se olvida al cambiarle de plan.
 */
export async function setPlanDelAlumno(clientId: string, planId: string | null, vip?: boolean): Promise<void> {
  await updateDoc(doc(db, 'users', clientId), {
    planId: planId ?? deleteField(),
    ...(vip === undefined ? {} : { vip }),
  });
}
