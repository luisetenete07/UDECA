import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  AJUSTES_POR_DEFECTO,
  idDeLlamada,
  type ActividadDeLlamada,
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
 *
 *  - `actividadLlamadas/{auto}`: lo que hace el ALUMNO (reservar, cancelar),
 *    para la bandeja "Por revisar" del entrenador. Se apunta aparte, después
 *    de reservar o cancelar y sin esperar: si apuntarlo fallara, la reserva o
 *    la cancelación siguen valiendo, que es lo que importa.
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
  // Solo reserva el alumno (las reglas no dejan a nadie más), así que esto es
  // siempre actividad suya.
  apuntarActividad('reservada', l).catch(() => {});
  return { id, ...datos };
}

/**
 * Cancela. Con `delAlumno` (la llamada que cancela el alumno) queda apuntado
 * para el entrenador; lo que cancela el propio entrenador no se le apunta a él.
 */
export async function cancelarLlamada(id: string, delAlumno?: Llamada): Promise<void> {
  await deleteDoc(doc(db, 'llamadas', id));
  if (delAlumno) apuntarActividad('cancelada', delAlumno).catch(() => {});
}

async function apuntarActividad(
  tipo: ActividadDeLlamada['tipo'],
  l: Pick<Llamada, 'trainerId' | 'clientId' | 'inicio'>
): Promise<void> {
  // La hora la pone el servidor: ni un reloj mal puesto ni nadie puede
  // apuntar algo con otra fecha (las reglas lo exigen).
  await addDoc(collection(db, 'actividadLlamadas'), {
    trainerId: l.trainerId,
    clientId: l.clientId,
    tipo,
    inicio: l.inicio,
    cuando: serverTimestamp(),
  });
}

/** Lo que han hecho sus alumnos con las llamadas desde `desde`, para la bandeja. */
export async function getActividadDeLlamadas(trainerId: string, desde: number): Promise<ActividadDeLlamada[]> {
  const snap = await getDocs(
    query(
      collection(db, 'actividadLlamadas'),
      where('trainerId', '==', trainerId),
      where('cuando', '>=', Timestamp.fromMillis(desde))
    )
  );
  return snap.docs.map((x) => {
    const d = x.data();
    return {
      id: x.id,
      trainerId: String(d.trainerId),
      clientId: String(d.clientId),
      tipo: d.tipo === 'cancelada' ? 'cancelada' : 'reservada',
      inicio: Number(d.inicio),
      cuando: d.cuando instanceof Timestamp ? d.cuando.toMillis() : Number(d.cuando ?? 0),
    };
  });
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
