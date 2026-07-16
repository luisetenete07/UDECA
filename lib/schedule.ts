import { dayDiff } from './stats';
import { todayWeekday, type Routine, type RoutineDay } from './types';

export interface TodaySession {
  /** Día de rutina que toca hoy, o null si no hay ninguno programado. */
  day: RoutineDay | null;
  /** true si hoy es un día de descanso (solo relevante si day es null o isRest). */
  isRest: boolean;
  /** true si hoy es un día de descanso OPCIONAL (el alumno decide, Día 7 TENA). */
  optionalRest: boolean;
  /** Etiqueta para el Método REIN TENA: "Día 2 de 4". Vacío en modo semanal. */
  cycleLabel?: string;
  /** Posición del día del ciclo (0-based), útil para preseleccionar la pestaña. */
  cycleIndex?: number;
}

/**
 * Índice del día del ciclo que corresponde a `now`, dado el ancla del ciclo
 * (Día 1) y la longitud del ciclo. Rota de forma constante e infinita.
 */
export function cycleDayIndex(cycleStartDate: number, cycleLength: number, now = Date.now()): number {
  if (cycleLength <= 0) return 0;
  const elapsed = dayDiff(cycleStartDate, now);
  return ((elapsed % cycleLength) + cycleLength) % cycleLength;
}

/**
 * Resuelve qué sesión toca HOY según el modo de programación de la rutina:
 *  - Método REIN TENA (cycle): rota por los días del ciclo desde su fecha de
 *    inicio, contando también los días de descanso.
 *  - Semanal (weekly): busca el día asignado al día de la semana de hoy.
 */
export function resolveTodaySession(
  routine: Routine | null,
  anchorOverride?: number
): TodaySession {
  if (!routine || routine.days.length === 0) {
    return { day: null, isRest: false, optionalRest: false };
  }

  // Modo flexible ("Sensaciones"): no hay día programado; el alumno elige la
  // rutina cada día según cómo se encuentre.
  if (routine.schedule === 'flex') {
    return { day: null, isRest: false, optionalRest: false };
  }

  if (routine.schedule === 'cycle' && routine.cycleStartDate) {
    // El ancla más reciente manda: si el alumno reinició su ciclo (override) o
    // el coach lo reprogramó (cycleStartDate), gana la fecha más nueva.
    const anchor = Math.max(routine.cycleStartDate, anchorOverride ?? 0);
    const idx = cycleDayIndex(anchor, routine.days.length);
    const day = routine.days[idx] ?? null;
    return {
      day: day && !day.isRest ? day : null,
      isRest: Boolean(day?.isRest),
      optionalRest: Boolean(day?.optionalRest),
      cycleLabel: `Día ${idx + 1} de ${routine.days.length}`,
      cycleIndex: idx,
    };
  }

  // Modo semanal (por defecto).
  const todays = routine.days.find((d) => d.weekday === todayWeekday());
  const usesWeekdays = routine.days.some((d) => d.weekday !== undefined);
  return {
    day: todays ?? (usesWeekdays ? null : routine.days[0]),
    isRest: usesWeekdays && !todays,
    optionalRest: false,
  };
}
