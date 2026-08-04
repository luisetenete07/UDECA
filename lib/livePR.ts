import { bestsByExercise, detectNewPRs } from './stats';
import type { LoggedExercise, LoggedSet, WorkoutLog } from './types';

/**
 * ¿La serie que se acaba de marcar es un récord?
 *
 * Se apoya en `detectNewPRs`, la MISMA función que usa el resumen del final.
 * Es deliberado: si la comprobación del momento tuviera su propia lógica,
 * antes o después celebraría algo que luego no aparece en el resumen, y una
 * celebración que después se desmiente vale menos que no celebrar nada.
 */
export interface LivePR {
  exerciseId: string;
  exerciseName: string;
  label: string;
  /** Cómo estaba la marca antes de hoy; null si es la primera vez. */
  previous: string | null;
}

/** Texto de la marca anterior, en las mismas unidades que el récord. */
function marcaAnterior(
  history: WorkoutLog[],
  exercise: LoggedExercise,
  esLastre: boolean
): string | null {
  const b = bestsByExercise(history)[exercise.exerciseId];
  if (!b) return null;
  if (esLastre) {
    if (b.bestWeightKg <= 0) return null;
    return `${b.bestWeightKg} kg × ${b.bestRepsAtWeight || '—'}`;
  }
  if (b.bestReps <= 0) return null;
  return `${b.bestReps} ${exercise.measure === 'seconds' ? 's' : 'reps'}`;
}

/**
 * Comprueba el ejercicio con la serie ya marcada. Devuelve el récord si lo hay.
 *
 * `sets` tiene que venir con el estado NUEVO (la serie ya completada), porque
 * al pulsar el ✓ el estado de React todavía no se ha actualizado.
 */
export function checkLivePR(
  history: WorkoutLog[],
  exercise: LoggedExercise,
  sets: LoggedSet[]
): LivePR | null {
  const conLaSerie: LoggedExercise = { ...exercise, sets };
  const prs = detectNewPRs(history, [conLaSerie]);
  if (prs.length === 0) return null;

  const pr = prs[0];
  return {
    exerciseId: exercise.exerciseId,
    exerciseName: pr.exerciseName,
    label: pr.label,
    previous: marcaAnterior(history, exercise, pr.label.includes('kg')),
  };
}
