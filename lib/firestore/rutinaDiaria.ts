import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { inicioDelDia } from '../fechas';
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
  await setDoc(
    doc(db, 'rutinasDiarias', rutina.clientId),
    { ...rutina, updatedAt: Date.now() },
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

/** Guarda lo hecho hoy. Lo escribe el ALUMNO: es él quien las hace. */
export async function setDiaDeRutinaDiaria(
  clientId: string,
  hechos: string[],
  trainerId?: string,
  dia = Date.now()
): Promise<void> {
  const date = inicioDelDia(dia);
  await setDoc(
    doc(db, 'rutinasDiariasDias', claveDelDia(clientId, date)),
    {
      clientId,
      date,
      hechos,
      updatedAt: Date.now(),
      ...(trainerId ? { trainerId } : {}),
    },
    { merge: true }
  );
}
