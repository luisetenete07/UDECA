import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  type QueryConstraint,
  type QuerySnapshot,
} from 'firebase/firestore';
import { stripUndefined } from './clean';
import { db } from '../firebase';
import type { WorkoutLog } from '../types';

const collectionRef = () => collection(db, 'workoutLogs');

/**
 * Techo de registros que se traen de una vez. Un alumno muy constante hace
 * ~200 sesiones al año, así que esto cubre varios años de historial; sin él,
 * la consulta crecería sin límite y cada carga se volvería más lenta y más
 * cara con el paso del tiempo.
 */
const MAX_LOGS = 1000;

function toLogs(snap: QuerySnapshot): WorkoutLog[] {
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as WorkoutLog)
    .sort((a, b) => b.date - a.date);
}

/**
 * Lee entrenamientos del más reciente al más antiguo, acotados a MAX_LOGS.
 *
 * Ordenar y limitar en el servidor exige un índice compuesto (están definidos
 * en firestore.indexes.json). Mientras no se publiquen, Firestore responde
 * `failed-precondition`; en ese caso caemos a la consulta de siempre para que
 * la app siga funcionando igual. Cualquier otro error (permisos, sin
 * conexión) se propaga tal cual.
 */
async function readLogs(filters: QueryConstraint[]): Promise<WorkoutLog[]> {
  try {
    return toLogs(
      await getDocs(query(collectionRef(), ...filters, orderBy('date', 'desc'), limit(MAX_LOGS)))
    );
  } catch (error) {
    if ((error as { code?: string })?.code !== 'failed-precondition') throw error;
    return toLogs(await getDocs(query(collectionRef(), ...filters)));
  }
}

export async function getWorkoutLog(id: string): Promise<WorkoutLog | null> {
  const snap = await getDoc(doc(db, 'workoutLogs', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as WorkoutLog) : null;
}

export async function getWorkoutLogsForClient(
  clientId: string,
  trainerId?: string
): Promise<WorkoutLog[]> {
  // Las pantallas del entrenador pasan trainerId: las reglas de Firestore
  // solo autorizan la consulta si esta demuestra el vinculo (filtro).
  return readLogs(
    trainerId
      ? [where('clientId', '==', clientId), where('trainerId', '==', trainerId)]
      : [where('clientId', '==', clientId)]
  );
}

export async function getWorkoutLogsForTrainer(trainerId: string): Promise<WorkoutLog[]> {
  return readLogs([where('trainerId', '==', trainerId)]);
}

export async function createWorkoutLog(
  data: Omit<WorkoutLog, 'id' | 'createdAt'>
): Promise<string> {
  const ref = await addDoc(collectionRef(), stripUndefined({ ...data, createdAt: Date.now() }));
  return ref.id;
}

/**
 * Corrige un entrenamiento ya guardado.
 *
 * Existe porque "Terminar entreno" es un botón grande al final de una lista de
 * series y se pulsa sin querer, o se pulsa a propósito habiéndose dejado la
 * última serie sin apuntar. Hasta ahora la única salida era borrar la sesión y
 * rehacerla entera —perdiendo la hora, la duración y el resto de las series—,
 * que es un castigo desproporcionado para un dedo.
 *
 * Lo que identifica la sesión (de quién es, de qué entrenador, cuándo fue) no
 * se toca: corregir es arreglar lo que se hizo, no mover el entreno a otro día
 * ni a otra persona. Las reglas de Firestore imponen lo mismo.
 */
export async function updateWorkoutLog(
  id: string,
  data: Pick<WorkoutLog, 'exercises'> & Partial<Pick<WorkoutLog, 'durationMin' | 'feedback'>>
): Promise<void> {
  await updateDoc(doc(db, 'workoutLogs', id), stripUndefined(data));
}

/** Borra un entrenamiento pasado (solo el propio alumno puede hacerlo). */
export async function deleteWorkoutLog(id: string): Promise<void> {
  await deleteDoc(doc(db, 'workoutLogs', id));
}
