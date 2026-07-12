import { startOfWeek } from './stats';
import type { WeeklyCheckIn, WorkoutLog } from './types';

/**
 * Análisis avanzado por alumno (determinista): estancamientos por ejercicio,
 * sugerencia de deload y desequilibrio empuje/tirón. Alimenta al Copiloto del
 * coach con señales que normalmente exigirían revisar el historial a mano.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Primer número de un texto de reps/segundos ("8-12" → 8, "60s" → 60). */
function parseNum(v: string): number {
  const m = String(v).match(/\d+(?:[.,]\d+)?/);
  return m ? parseFloat(m[0].replace(',', '.')) : 0;
}

export interface ClientInsights {
  /** Ejercicios sin mejora en las últimas sesiones (nombre legible). */
  stagnated: string[];
  /** true si los datos sugieren programar una semana de descarga. */
  deloadSuggested: boolean;
  /** Patrón sobredimensionado en el último mes, o null si está equilibrado. */
  imbalance: 'empuje' | 'tirón' | null;
}

/**
 * Estancamiento: un ejercicio con ≥4 sesiones cuyo mejor valor en las 2
 * últimas no supera el mejor de las 2 anteriores (misma vara: reps o seg).
 */
function detectStagnation(logs: WorkoutLog[]): string[] {
  const sessions = new Map<string, { name: string; points: number[] }>();
  // logs llegan ordenados desc; recorremos asc para acumular en orden temporal.
  for (const log of [...logs].sort((a, b) => a.date - b.date)) {
    for (const ex of log.exercises) {
      let best = 0;
      for (const set of ex.sets) {
        if (set.completed) best = Math.max(best, parseNum(set.reps));
      }
      if (best <= 0) continue;
      const cur = sessions.get(ex.exerciseId) ?? { name: ex.name, points: [] };
      cur.points.push(best);
      sessions.set(ex.exerciseId, cur);
    }
  }
  const stuck: string[] = [];
  for (const { name, points } of sessions.values()) {
    if (points.length < 4) continue;
    const recent = Math.max(...points.slice(-2));
    const before = Math.max(...points.slice(-4, -2));
    if (recent <= before) stuck.push(name);
  }
  return stuck.slice(0, 3); // los 3 más relevantes bastan como señal
}

/**
 * Deload: volumen de series de las 2 últimas semanas claramente por debajo de
 * las 2 anteriores (< 70%) o sensaciones físicas ≤2 en el último check-in
 * junto a una bajada de volumen. Señal, no sentencia: decide el coach.
 */
function suggestDeload(logs: WorkoutLog[], checkIns: WeeklyCheckIn[]): boolean {
  const week = startOfWeek(Date.now());
  const setsInWeeks = (from: number, to: number) => {
    let sets = 0;
    for (const log of logs) {
      const w = startOfWeek(log.date);
      if (w >= from && w <= to) {
        for (const ex of log.exercises) sets += ex.sets.filter((s) => s.completed).length;
      }
    }
    return sets;
  };
  const recent = setsInWeeks(week - 7 * DAY_MS, week);
  const prior = setsInWeeks(week - 21 * DAY_MS, week - 14 * DAY_MS);
  if (prior < 12) return false; // sin base suficiente para comparar
  const dropping = recent < prior * 0.7;
  const lastCheckIn = checkIns[0];
  const soreLow = !!lastCheckIn && lastCheckIn.soreness <= 2;
  return (dropping && soreLow) || (dropping && recent < prior * 0.5);
}

/** Desequilibrio: series de empuje vs tirón en los últimos 28 días (≥1,6×). */
function detectImbalance(
  logs: WorkoutLog[],
  muscleByExercise: Record<string, string>
): 'empuje' | 'tirón' | null {
  const since = Date.now() - 28 * DAY_MS;
  let push = 0;
  let pull = 0;
  for (const log of logs) {
    if (log.date < since) continue;
    for (const ex of log.exercises) {
      const group = muscleByExercise[ex.exerciseId];
      const done = ex.sets.filter((s) => s.completed).length;
      if (group === 'Empuje') push += done;
      else if (group === 'Tirón') pull += done;
    }
  }
  if (push + pull < 12) return null;
  if (push >= pull * 1.6) return 'empuje';
  if (pull >= push * 1.6) return 'tirón';
  return null;
}

export function analyzeClient(
  logs: WorkoutLog[],
  checkIns: WeeklyCheckIn[],
  muscleByExercise: Record<string, string>
): ClientInsights {
  return {
    stagnated: detectStagnation(logs),
    deloadSuggested: suggestDeload(logs, checkIns),
    imbalance: detectImbalance(logs, muscleByExercise),
  };
}
