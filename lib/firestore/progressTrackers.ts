import { deleteField, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Qué ejercicios sigue el entrenador en la tabla de progreso semanal de un
 * alumno. Doc id = clientId.
 *
 * Por defecto la tabla muestra todo lo que el alumno ha registrado, que con el
 * tiempo son demasiadas filas para leer nada. Aquí se guarda la lista corta que
 * el entrenador quiere vigilar de verdad. Sin documento = comportamiento de
 * antes (todos los ejercicios), así que nadie tiene que configurar nada para
 * que la pantalla siga funcionando.
 */
export interface ProgressTracker {
  trainerId: string;
  clientId: string;
  /** Ejercicios seguidos, en el orden en que los quiere ver el entrenador. */
  exerciseIds: string[];
  updatedAt: number;
}

export async function getProgressTracker(clientId: string): Promise<string[] | null> {
  try {
    const snap = await getDoc(doc(db, 'progressTrackers', clientId));
    if (!snap.exists()) return null;
    const ids = snap.data().exerciseIds;
    return Array.isArray(ids) ? (ids as string[]) : null;
  } catch {
    // Sin selección guardada (o sin permiso para leerla) la tabla debe seguir
    // pintándose con todo, no quedarse en blanco.
    return null;
  }
}

export async function saveProgressTracker(
  trainerId: string,
  clientId: string,
  exerciseIds: string[]
): Promise<void> {
  await setDoc(
    doc(db, 'progressTrackers', clientId),
    { trainerId, clientId, exerciseIds, updatedAt: Date.now() },
    { merge: true }
  );
}

/** Vuelve al comportamiento por defecto: seguir todos los ejercicios. */
export async function clearProgressTracker(
  trainerId: string,
  clientId: string
): Promise<void> {
  await setDoc(
    doc(db, 'progressTrackers', clientId),
    { trainerId, clientId, exerciseIds: deleteField(), updatedAt: Date.now() },
    { merge: true }
  );
}
