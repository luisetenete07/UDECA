import { frase, t } from './idioma';
import { bestsByExercise, detectNewPRs, effectiveLoadKg, loadLabel, parseReps } from './stats';
import { cuentaComoMarca, type LoggedExercise, type LoggedSet, type WorkoutLog } from './types';

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
  /** Cuánto ha mejorado ("+3 reps"). */
  mejora?: string | null;
  /** Cuándo puso la marca anterior ("hace 5 semanas"). */
  desde?: string | null;
}

/** Texto de la marca anterior, en las mismas unidades que el récord. */
export function marcaAnterior(
  history: WorkoutLog[],
  exercise: LoggedExercise,
  esDeCarga: boolean
): string | null {
  const b = bestsByExercise(history)[exercise.exerciseId];
  if (!b) return null;
  if (esDeCarga) {
    if (!Number.isFinite(b.bestLoadKg) || b.bestLoadKg === 0) return null;
    return `${loadLabel(b.bestLoadKg)} × ${b.bestRepsAtLoad || '—'}`;
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
  const esDeCarga = pr.label.includes('kg');
  const contexto = contextoDelRecord(history, exercise, sets, esDeCarga);
  return {
    exerciseId: exercise.exerciseId,
    exerciseName: pr.exerciseName,
    label: pr.label,
    previous: marcaAnterior(history, exercise, esDeCarga),
    mejora: contexto.mejora,
    desde: contexto.desde,
  };
}

/**
 * "hace 5 semanas": cuánto hace, en la unidad en la que se piensa.
 *
 * Días hasta dos semanas, semanas hasta dos meses, meses después. "Hace 38
 * días" obliga a hacer la cuenta; "hace 5 semanas" ya es el dato.
 */
export function haceTiempo(dias: number): string {
  if (dias <= 0) return t('hoy');
  if (dias === 1) return t('ayer');
  if (dias < 14) return frase`hace ${dias} días`;
  if (dias < 60) return frase`hace ${Math.round(dias / 7)} semanas`;
  const meses = Math.round(dias / 30);
  return meses <= 1 ? t('hace 1 mes') : frase`hace ${meses} meses`;
}

export interface ContextoDelRecord {
  /** Lo que ha mejorado: "+3 reps", "+2,5 kg". */
  mejora: string | null;
  /** Cuándo puso la marca que acaba de batir: "hace 5 semanas". */
  desde: string | null;
}

/**
 * EL RÉCORD, CON SU HISTORIA.
 *
 * "15 reps" es un número; "+3 reps sobre tu marca de hace 5 semanas" es lo que
 * de verdad se celebra: cuánto ha costado y cuánto ha tardado. Se calcula con
 * las mismas mejores marcas que deciden si hay récord (`bestsByExercise`), así
 * que nunca cuenta una mejora que la app no considere récord.
 */
export function contextoDelRecord(
  history: WorkoutLog[],
  exercise: LoggedExercise,
  sets: LoggedSet[],
  esDeCarga: boolean,
  ahora = Date.now()
): ContextoDelRecord {
  const b = bestsByExercise(history)[exercise.exerciseId];
  if (!b) return { mejora: null, desde: null };
  const unidad = exercise.measure === 'seconds' || exercise.measure === 'secondsDual' ? 's' : 'reps';

  // Lo mejor de hoy, con la misma regla que el récord.
  let pesado: { kg: number; r: number } | null = null;
  let maxReps = 0;
  for (const s of sets) {
    if (!cuentaComoMarca(s)) continue;
    const kg = effectiveLoadKg(exercise, s.weight);
    const r = parseReps(s.reps);
    if (kg !== 0 && (!pesado || kg > pesado.kg || (kg === pesado.kg && r > pesado.r))) pesado = { kg, r };
    if (kg === 0 && r > maxReps) maxReps = r;
  }

  let mejora: string | null = null;
  let esLaMarca: (kg: number, r: number) => boolean;
  if (esDeCarga && pesado && Number.isFinite(b.bestLoadKg)) {
    const dif = Math.round((pesado.kg - b.bestLoadKg) * 100) / 100;
    if (dif > 0) mejora = `+${String(dif).replace('.', ',')} kg`;
    else if (pesado.r > b.bestRepsAtLoad) mejora = `+${pesado.r - b.bestRepsAtLoad} ${unidad}`;
    esLaMarca = (kg, r) => kg === b.bestLoadKg && r === b.bestRepsAtLoad;
  } else {
    if (b.bestReps > 0 && maxReps > b.bestReps) mejora = `+${maxReps - b.bestReps} ${unidad}`;
    esLaMarca = (kg, r) => kg === 0 && r === b.bestReps;
  }

  // Cuándo la puso: el primer entreno en el que llegó a esa marca.
  let fecha: number | null = null;
  for (const log of history) {
    const ex = log.exercises.find((e) => e.exerciseId === exercise.exerciseId);
    if (!ex) continue;
    const la = ex.sets.some(
      (s) => cuentaComoMarca(s) && esLaMarca(effectiveLoadKg(ex, s.weight), parseReps(s.reps))
    );
    if (la && (fecha === null || log.date < fecha)) fecha = log.date;
  }
  const dias = fecha === null ? null : Math.floor((ahora - fecha) / 86_400_000);
  return { mejora, desde: dias === null ? null : haceTiempo(dias) };
}

/** El contexto en una línea, para el resumen del entreno. */
export function contextoEnUnaLinea(c: ContextoDelRecord, previo: string | null): string | undefined {
  const partes: string[] = [];
  if (c.mejora) partes.push(c.mejora);
  if (previo) partes.push(c.desde ? frase`antes ${previo}, ${c.desde}` : frase`antes ${previo}`);
  return partes.length > 0 ? partes.join(' · ') : undefined;
}
