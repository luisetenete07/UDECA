import { inicioDeLaSemana } from './fechas';
import { sessionTotals } from './stats';
import type { TrainingCycle, WorkoutLog } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export type CycleStatus = 'open' | 'planned' | 'active' | 'completed';

export interface CycleStats {
  status: CycleStatus;
  statusLabel: string;
  /** Entrenos registrados dentro del rango del ciclo. */
  sessionsDone: number;
  /** Meta de sesiones (si el coach la fijó). */
  targetSessions: number | null;
  /** 0..1 o null si no se puede calcular (sin fechas ni meta). */
  pctComplete: number | null;
  /** Duración total en días (si tiene inicio y fin). */
  durationDays: number | null;
  /** Días transcurridos desde el inicio (si ya empezó). */
  daysElapsed: number | null;
  /** Frecuencia media de entreno (sesiones por semana). */
  sessionsPerWeek: number | null;
  /** Volumen total de lastre movido (kg); las gomas no cuentan. */
  totalVolumeKg: number;
  /** Duración media de sesión en minutos (si los logs la traen). */
  avgSessionMin: number | null;
  /** Entrenos del ciclo, del más reciente al más antiguo. */
  logs: WorkoutLog[];
}

/** ¿Cae este entreno dentro del rango de fechas del ciclo? (fin inclusive). */
export function isLogInCycle(log: WorkoutLog, cycle: TrainingCycle): boolean {
  if (cycle.startDate && log.date < cycle.startDate) return false;
  if (cycle.endDate && log.date >= cycle.endDate + DAY_MS) return false;
  return true;
}

export function computeCycleStats(cycle: TrainingCycle, allLogs: WorkoutLog[]): CycleStats {
  const now = Date.now();
  const logs = allLogs.filter((l) => isLogInCycle(l, cycle)).sort((a, b) => b.date - a.date);
  const sessionsDone = logs.length;

  const totalVolumeKg = logs.reduce((sum, l) => sum + sessionTotals(l.exercises).volumeKg, 0);

  const durations = logs.map((l) => l.durationMin ?? 0).filter((d) => d > 0);
  const avgSessionMin =
    durations.length > 0
      ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
      : null;

  // Estado según fechas (sin anulación manual en el MVP).
  let status: CycleStatus;
  if (!cycle.startDate && !cycle.endDate) status = 'open';
  else if (cycle.startDate && now < cycle.startDate) status = 'planned';
  else if (cycle.endDate && now >= cycle.endDate + DAY_MS) status = 'completed';
  else status = 'active';

  const statusLabel = {
    open: 'Abierto',
    planned: 'Planificado',
    active: 'En curso',
    completed: 'Completado',
  }[status];

  const durationDays =
    cycle.startDate && cycle.endDate
      ? Math.max(1, Math.round((cycle.endDate - cycle.startDate) / DAY_MS) + 1)
      : null;

  const daysElapsed = cycle.startDate
    ? Math.max(0, Math.floor((Math.min(now, cycle.endDate ?? now) - cycle.startDate) / DAY_MS) + 1)
    : null;

  // Frecuencia: sesiones / semanas transcurridas (o duración total si terminó).
  const weeksBase =
    status === 'completed' && durationDays ? durationDays / 7 : (daysElapsed ?? 0) / 7;
  const sessionsPerWeek =
    weeksBase >= 0.5 ? Math.round((sessionsDone / weeksBase) * 10) / 10 : null;

  const targetSessions = cycle.targetSessions ?? null;
  let pctComplete: number | null = null;
  if (targetSessions && targetSessions > 0) {
    pctComplete = Math.min(1, sessionsDone / targetSessions);
  } else if (durationDays && daysElapsed != null) {
    pctComplete = Math.min(1, daysElapsed / durationDays);
  }

  return {
    status,
    statusLabel,
    sessionsDone,
    targetSessions,
    pctComplete,
    durationDays,
    daysElapsed,
    sessionsPerWeek,
    totalVolumeKg,
    avgSessionMin,
    logs,
  };
}

/**
 * En qué semana del mesociclo estamos y de cuántas (si el coach fijó fin).
 * Se cuenta por semanas naturales desde el inicio del ciclo.
 */
export function cycleWeekInfo(cycle: TrainingCycle): { week: number; totalWeeks: number | null } {
  const now = Date.now();
  const anchor = cycle.startDate ?? now;
  const cappedNow = cycle.endDate ? Math.min(now, cycle.endDate) : now;
  const week =
    Math.floor((inicioDeLaSemana(Math.max(cappedNow, anchor)) - inicioDeLaSemana(anchor)) / (7 * DAY_MS)) + 1;
  const totalWeeks =
    cycle.startDate && cycle.endDate
      ? Math.max(1, Math.round((cycle.endDate - cycle.startDate) / DAY_MS / 7))
      : null;
  return { week: Math.max(1, week), totalWeeks };
}

/** El ciclo "en curso" más relevante de una lista (para mostrar al alumno). */
export function activeCycle(cycles: TrainingCycle[]): TrainingCycle | null {
  const now = Date.now();
  const ongoing = cycles.filter(
    (c) =>
      (!c.startDate || c.startDate <= now) &&
      (!c.endDate || now < c.endDate + DAY_MS) &&
      (c.startDate || c.endDate)
  );
  // Preferimos el de rango más corto (microciclo antes que macro).
  ongoing.sort((a, b) => {
    const ad = (a.endDate ?? now) - (a.startDate ?? 0);
    const bd = (b.endDate ?? now) - (b.startDate ?? 0);
    return ad - bd;
  });
  return ongoing[0] ?? null;
}
