import { startOfWeek } from './stats';
import type { Routine, TrainingCycle, WeekPlanEntry } from './types';

/**
 * La programación de CADA semana.
 *
 * La rutina dice qué se hace (ejercicios, orden, descansos, superseries) y no
 * cambia. El microciclo dice cuánto se hace ESTA semana: 4×8 la primera, 5×8 la
 * tercera, la mitad en la de descarga. Es lo único que un entrenador escribía
 * en columnas distintas de su hoja, y lo único que la app no sabía guardar.
 *
 * Se resuelve al leer, no al escribir: la rutina nunca se modifica. Así, si el
 * entrenador borra el plan o cambia de idea, el alumno se queda con su rutina
 * intacta en vez de con los restos de la última semana programada.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** El microciclo que cubre `now`, si el alumno tiene un plan por semanas. */
export function currentWeekCycle(
  cycles: TrainingCycle[],
  now = Date.now()
): TrainingCycle | null {
  const semana = startOfWeek(now);
  return (
    cycles.find(
      (c) => c.level === 'micro' && c.startDate != null && startOfWeek(c.startDate) === semana
    ) ?? null
  );
}

/** Los ajustes de esa semana, indexados por ejercicio. */
export function weekPlanMap(cycle: TrainingCycle | null): Map<string, WeekPlanEntry> {
  return new Map((cycle?.weekPlan ?? []).map((e) => [e.exerciseId, e]));
}

/**
 * Devuelve la rutina con los números de la semana ya aplicados.
 *
 * Si no hay plan de semana, devuelve **la misma referencia**: quien la use no
 * tiene que saber si hay ciclos o no, y React no repinta de más.
 */
export function applyWeekPlan(
  routine: Routine | null,
  cycles: TrainingCycle[],
  now = Date.now()
): Routine | null {
  if (!routine) return null;
  const semana = currentWeekCycle(cycles, now);
  const ajustes = weekPlanMap(semana);
  if (ajustes.size === 0) return routine;

  return {
    ...routine,
    days: routine.days.map((d) => ({
      ...d,
      exercises: d.exercises.map((ex) => {
        const a = ajustes.get(ex.exerciseId);
        if (!a) return ex;
        return {
          ...ex,
          sets: a.sets ?? ex.sets,
          reps: a.reps ?? ex.reps,
          rir: a.rir ?? ex.rir,
        };
      }),
    })),
  };
}

/**
 * Punto de partida al programar una semana: lo que se puso la semana anterior
 * y, si no había nada, lo que dice la rutina.
 *
 * "Duplicar y ajustar" en vez de reglas automáticas del tipo "+1 repetición por
 * semana": las reglas se rompen en cuanto alguien se lesiona o se salta una
 * semana, y entonces se pelea uno con el sistema en vez de con el entrenamiento.
 */
export function weekPlanDraft(
  routine: Routine | null,
  cycles: TrainingCycle[],
  micro: TrainingCycle
): WeekPlanEntry[] {
  const previa = semanaAnterior(cycles, micro);
  const dePrevia = weekPlanMap(previa);

  const vistos = new Map<string, WeekPlanEntry>();
  for (const dia of routine?.days ?? []) {
    if (dia.isRest) continue;
    for (const ex of dia.exercises) {
      if (vistos.has(ex.exerciseId)) continue;
      const base = dePrevia.get(ex.exerciseId);
      vistos.set(ex.exerciseId, {
        exerciseId: ex.exerciseId,
        sets: base?.sets ?? ex.sets,
        reps: base?.reps ?? ex.reps,
        rir: base?.rir ?? ex.rir,
      });
    }
  }
  return [...vistos.values()];
}

/** El microciclo inmediatamente anterior dentro del mismo plan. */
export function semanaAnterior(
  cycles: TrainingCycle[],
  micro: TrainingCycle
): TrainingCycle | null {
  if (micro.startDate == null) return null;
  const anterior = micro.startDate - 7 * DAY_MS;
  return (
    cycles.find(
      (c) =>
        c.level === 'micro' &&
        c.id !== micro.id &&
        c.startDate != null &&
        startOfWeek(c.startDate) === startOfWeek(anterior)
    ) ?? null
  );
}

/** Nombres de los ejercicios de la rutina, para pintar la hoja de la semana. */
export function exerciseNames(routine: Routine | null): Map<string, string> {
  const nombres = new Map<string, string>();
  for (const dia of routine?.days ?? []) {
    for (const ex of dia.exercises) if (!nombres.has(ex.exerciseId)) nombres.set(ex.exerciseId, ex.name);
  }
  return nombres;
}

/**
 * Series por grupo muscular que pide una semana concreta.
 *
 * Con plan de semana el número es EXACTO (lo que el entrenador escribió); sin
 * él hay que conformarse con el promedio de la rutina, que es lo que hacía
 * `lib/blockView.ts` antes de que existieran las semanas.
 */
export function weekSetsByGroup(
  micro: TrainingCycle | null,
  routine: Routine | null,
  muscleByExercise: Record<string, string>
): Record<string, number> | null {
  const ajustes = weekPlanMap(micro);
  if (ajustes.size === 0 || !routine) return null;

  const porGrupo: Record<string, number> = {};
  for (const dia of routine.days) {
    if (dia.isRest) continue;
    for (const ex of dia.exercises) {
      const a = ajustes.get(ex.exerciseId);
      const series = a?.sets ?? ex.sets ?? 0;
      const grupo = ex.muscleGroup || muscleByExercise[ex.exerciseId] || 'Otros';
      porGrupo[grupo] = (porGrupo[grupo] ?? 0) + series;
    }
  }
  return porGrupo;
}
