import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { inicioDelDia } from '../fechas';
import { stripUndefined } from './clean';
import type { DiaDeRutinaDiaria, RutinaDiaria } from '../types';

/**
 * La rutina diaria de cada alumno, y lo que lleva hecho hoy.
 *
 * DOS DOCUMENTOS Y NINGUNA CONSULTA
 *
 * El id de la rutina ES el uid del alumno, y el del día es
 * `${uid}_${aaaa-mm-dd}`. Así todo se lee y se escribe por id directo, sin
 * consultas ni índices: una rutina diaria por alumno y un registro por día, sin
 * forma de acabar con dos.
 *
 * Es el mismo patrón que los pasos (lib/firestore/steps.ts), y por el mismo
 * motivo: son cosas que se escriben una y otra vez el mismo día —se marca un
 * ejercicio, se desmarca, se vuelve a marcar— y con `addDoc` cada toque dejaría
 * un documento nuevo.
 */

const claveDelDia = (clientId: string, dia: number) =>
  `${clientId}_${new Date(inicioDelDia(dia)).toISOString().slice(0, 10)}`;

/** La rutina diaria de ese alumno, o nada si no le han puesto ninguna. */
export async function getRutinaDiaria(clientId: string): Promise<RutinaDiaria | null> {
  const s = await getDoc(doc(db, 'rutinasDiarias', clientId));
  return s.exists() ? ({ id: s.id, ...s.data() } as RutinaDiaria) : null;
}

/** La guarda entera (la escribe el entrenador, o el atleta para sí mismo). */
export async function setRutinaDiaria(
  rutina: Omit<RutinaDiaria, 'id' | 'updatedAt'>
): Promise<void> {
  // Sin los campos vacíos: Firestore no guarda un `undefined` (al borrar el
  // vídeo o las indicaciones de un ejercicio, el guardado entero fallaba).
  await setDoc(
    doc(db, 'rutinasDiarias', rutina.clientId),
    stripUndefined({ ...rutina, updatedAt: Date.now() }),
    { merge: true }
  );
}

/** Lo hecho HOY por ese alumno. */
export async function getDiaDeRutinaDiaria(
  clientId: string,
  dia = Date.now()
): Promise<DiaDeRutinaDiaria | null> {
  const s = await getDoc(doc(db, 'rutinasDiariasDias', claveDelDia(clientId, dia)));
  return s.exists() ? ({ id: s.id, ...s.data() } as DiaDeRutinaDiaria) : null;
}

/**
 * Guarda lo hecho hoy. Lo escribe el ALUMNO: es él quien las hace.
 *
 * Con `extra`, también las series que haya cambiado hoy y cuántas marcas
 * había que hacer (lo que el historial compara después).
 */
export async function setDiaDeRutinaDiaria(
  clientId: string,
  hechos: string[],
  trainerId?: string,
  dia = Date.now(),
  extra?: { series?: Record<string, number>; total?: number }
): Promise<void> {
  const date = inicioDelDia(dia);
  const datos = {
    clientId,
    date,
    hechos,
    updatedAt: Date.now(),
    ...(trainerId ? { trainerId } : {}),
    ...(extra?.series ? { series: extra.series } : {}),
    ...(typeof extra?.total === 'number' ? { total: extra.total } : {}),
  };
  // Cada campo que se manda se REEMPLAZA entero (`mergeFields`) y el resto no
  // se toca. Con un merge normal, un ejercicio que vuelve a sus series de
  // siempre seguiría en `series`: el merge mezcla los mapas y no borra claves.
  await setDoc(doc(db, 'rutinasDiariasDias', claveDelDia(clientId, date)), datos, {
    mergeFields: Object.keys(datos),
  });
}

/**
 * Los días de la rutina diaria desde `desde`, para el historial.
 *
 * El alumno pide los suyos; el entrenador, los de SU alumno (las reglas solo le
 * dejan listar los que llevan su `trainerId`). Si el índice aún no está creado,
 * se cae a la consulta sin acotar y se filtra aquí: funciona igual, solo lee más.
 */
export async function getDiasDeRutinaDiaria(
  clientId: string,
  desde: number,
  trainerId?: string
): Promise<DiaDeRutinaDiaria[]> {
  const base = [
    where('clientId', '==', clientId),
    ...(trainerId ? [where('trainerId', '==', trainerId)] : []),
  ];
  const leer = (snap: Awaited<ReturnType<typeof getDocs>>) =>
    snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as object) }) as DiaDeRutinaDiaria)
      .filter((d) => d.date >= desde)
      .sort((a, b) => a.date - b.date);
  try {
    return leer(await getDocs(query(collection(db, 'rutinasDiariasDias'), ...base, where('date', '>=', desde))));
  } catch {
    return leer(await getDocs(query(collection(db, 'rutinasDiariasDias'), ...base)));
  }
}
