import type { WeightLog, WorkoutLog } from './types';

export interface LastPerformance {
  weight?: string;
  reps?: string;
  date: number;
}

/**
 * Para cada ejercicio (por exerciseId), devuelve el mejor/último registro
 * previo: el peso y reps de la serie más pesada de la última sesión en que
 * se hizo. Mostrar el rendimiento anterior mientras entrenas es una función
 * clave de las apps de coaching líderes (TrueCoach, Trainerize).
 */
export function lastPerformanceByExercise(
  logs: WorkoutLog[]
): Record<string, LastPerformance> {
  const sorted = [...logs].sort((a, b) => b.date - a.date);
  const result: Record<string, LastPerformance> = {};

  for (const log of sorted) {
    for (const ex of log.exercises) {
      if (result[ex.exerciseId]) continue; // ya tenemos el más reciente
      // Serie con más peso registrado en esa sesión.
      let best: { weight?: string; reps?: string } | null = null;
      let bestWeight = -1;
      for (const set of ex.sets) {
        const w = Number(set.weight);
        if (set.weight && !Number.isNaN(w) && w > bestWeight) {
          bestWeight = w;
          best = { weight: set.weight, reps: set.reps };
        }
      }
      if (!best && ex.sets.length > 0) {
        best = { reps: ex.sets[0].reps };
      }
      if (best) {
        result[ex.exerciseId] = { ...best, date: log.date };
      }
    }
  }

  return result;
}

const DAY_MS = 1000 * 60 * 60 * 24;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfWeek(ts: number): number {
  const d = new Date(ts);
  const day = d.getDay() === 0 ? 7 : d.getDay();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day + 1);
  return d.getTime();
}

/**
 * Racha actual de días de entrenamiento: número de días consecutivos (hasta
 * hoy o ayer) en los que se registró al menos una sesión. Es la métrica de
 * constancia que usan apps como Strava, Duolingo o Future.
 */
export function currentStreak(logs: WorkoutLog[]): number {
  if (logs.length === 0) return 0;
  const days = new Set(logs.map((l) => startOfDay(l.date)));
  const today = startOfDay(Date.now());

  // La racha sigue viva si entrenó hoy o ayer.
  let cursor = days.has(today) ? today : today - DAY_MS;
  if (!days.has(cursor)) return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

/** Número de sesiones registradas en la semana en curso (lunes-domingo). */
export function sessionsThisWeek(logs: WorkoutLog[]): number {
  const weekStart = startOfWeek(Date.now());
  return logs.filter((l) => l.date >= weekStart).length;
}

/** Número de semanas distintas con al menos un entrenamiento. */
export function activeWeeks(logs: WorkoutLog[]): number {
  return new Set(logs.map((l) => startOfWeek(l.date))).size;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // nombre de icono Ionicons
  unlocked: boolean;
}

/**
 * Calcula el estado de los logros a partir de los datos ya existentes del
 * alumno. Los logros/insignias son un patrón clásico de gamificación en las
 * mejores apps de fitness para reforzar la adherencia.
 */
export function computeAchievements(
  workoutLogs: WorkoutLog[],
  weightLogs: WeightLog[]
): Achievement[] {
  const totalWorkouts = workoutLogs.length;
  const streak = currentStreak(workoutLogs);
  const weeks = activeWeeks(workoutLogs);
  const weightEntries = weightLogs.length;

  const weightProgress =
    weightLogs.length >= 2
      ? weightLogs[weightLogs.length - 1].weightKg - weightLogs[0].weightKg
      : 0;

  return [
    {
      id: 'first-workout',
      title: 'Primer paso',
      description: 'Completa tu primer entrenamiento',
      icon: 'flag',
      unlocked: totalWorkouts >= 1,
    },
    {
      id: 'ten-workouts',
      title: 'Constante',
      description: 'Registra 10 entrenamientos',
      icon: 'barbell',
      unlocked: totalWorkouts >= 10,
    },
    {
      id: 'fifty-workouts',
      title: 'Guerrero',
      description: 'Registra 50 entrenamientos',
      icon: 'flame',
      unlocked: totalWorkouts >= 50,
    },
    {
      id: 'streak-3',
      title: 'En racha',
      description: '3 días seguidos entrenando',
      icon: 'trending-up',
      unlocked: streak >= 3,
    },
    {
      id: 'streak-7',
      title: 'Imparable',
      description: '7 días seguidos entrenando',
      icon: 'rocket',
      unlocked: streak >= 7,
    },
    {
      id: 'month-active',
      title: 'Mes de fuego',
      description: 'Entrena durante 4 semanas distintas',
      icon: 'calendar',
      unlocked: weeks >= 4,
    },
    {
      id: 'tracker',
      title: 'Bajo control',
      description: 'Registra tu peso 5 veces',
      icon: 'scale',
      unlocked: weightEntries >= 5,
    },
    {
      id: 'transformation',
      title: 'Transformación',
      description: 'Reduce 3 kg desde tu inicio',
      icon: 'ribbon',
      unlocked: weightProgress <= -3,
    },
  ];
}
