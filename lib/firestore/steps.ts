import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { inicioDelDia } from '../fechas';
import type { OrigenDePasos, RegistroDePasos } from '../pasos';

/**
 * Los pasos de cada día.
 *
 * Un documento por alumno y día, con el id compuesto por los dos. Es lo que
 * permite escribir el mismo día una y otra vez —los pasos crecen a lo largo de
 * la jornada— sin acabar con cuarenta registros del martes: con `addDoc` cada
 * lectura del móvil habría creado uno nuevo.
 */

const clave = (clientId: string, dia: number) =>
  `${clientId}_${new Date(inicioDelDia(dia)).toISOString().slice(0, 10)}`;

export interface StepLog extends RegistroDePasos {
  id: string;
  clientId: string;
  trainerId?: string;
  updatedAt: number;
}

export async function getStepLogsForClient(
  clientId: string,
  trainerId?: string
): Promise<StepLog[]> {
  // Las pantallas del entrenador pasan trainerId: las reglas solo autorizan la
  // consulta si esta demuestra el vínculo.
  const q = trainerId
    ? query(collection(db, 'stepLogs'), where('clientId', '==', clientId), where('trainerId', '==', trainerId))
    : query(collection(db, 'stepLogs'), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as StepLog)
    .sort((a, b) => b.date - a.date);
}

/** Guarda (o pisa) los pasos de un día. */
export async function setStepLog(
  clientId: string,
  dia: number,
  steps: number,
  source: OrigenDePasos,
  trainerId?: string
): Promise<void> {
  const date = inicioDelDia(dia);
  await setDoc(
    doc(db, 'stepLogs', clave(clientId, date)),
    {
      clientId,
      date,
      steps: Math.max(0, Math.round(steps)),
      source,
      updatedAt: Date.now(),
      ...(trainerId ? { trainerId } : {}),
    },
    { merge: true }
  );
}
