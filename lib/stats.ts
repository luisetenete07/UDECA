import type { LoggedExercise, WeightLog, WorkoutLog } from './types';

/**
 * Convierte a número tolerando la coma decimal española (66,4 → 66.4). Sin
 * esto, `Number("66,4")` da NaN y el peso se perdería en volúmenes y marcas.
 */
export function toNum(value: string | number | undefined | null): number {
  if (value == null) return NaN;
  return Number(String(value).replace(',', '.'));
}

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
        const w = toNum(set.weight);
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

/**
 * Suma días de calendario devolviendo la medianoche local resultante.
 * Imprescindible frente a sumar milisegundos: el día del cambio de hora
 * dura 23 o 25 horas y desalinearía rachas, mapas y semanas.
 */
export function addDays(ts: number, n: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Número de días de calendario entre dos fechas (b - a). El round() absorbe
 * el desfase de ±1h de los cambios de hora, así que es seguro frente a DST.
 */
export function dayDiff(a: number, b: number): number {
  return Math.round((startOfDay(b) - startOfDay(a)) / (1000 * 60 * 60 * 24));
}

export function startOfDay(ts: number): number {
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
/**
 * Racha con protector: cuenta DÍAS ENTRENADOS y tolera un día de descanso
 * entre sesiones (el descanso forma parte del plan — en el Método REIN TENA
 * se entrena a días alternos). Se rompe con 2+ días seguidos sin entrenar.
 */
export function currentStreak(logs: WorkoutLog[]): number {
  if (logs.length === 0) return 0;
  const DAY = 24 * 60 * 60 * 1000;
  const days = [...new Set(logs.map((l) => startOfDay(l.date)))].sort((a, b) => b - a);
  const today = startOfDay(Date.now());

  // Viva si entrenó hoy, ayer o anteayer (un descanso de por medio cuenta).
  if (today - days[0] > 2 * DAY) return 0;

  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const gapDays = Math.round((days[i - 1] - days[i]) / DAY);
    if (gapDays <= 2) streak += 1;
    else break;
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
    {
      id: 'hundred-workouts',
      title: 'Centurión',
      description: 'Registra 100 entrenamientos',
      icon: 'shield-checkmark',
      unlocked: totalWorkouts >= 100,
    },
    {
      id: 'streak-14',
      title: 'Máquina',
      description: '14 días seguidos entrenando',
      icon: 'flash',
      unlocked: streak >= 14,
    },
    {
      id: 'streak-30',
      title: 'Leyenda',
      description: '30 días seguidos entrenando',
      icon: 'trophy',
      unlocked: streak >= 30,
    },
    {
      id: 'weeks-12',
      title: 'Trimestre',
      description: 'Entrena durante 12 semanas distintas',
      icon: 'medal',
      unlocked: weeks >= 12,
    },
    {
      id: 'twentyfive-workouts',
      title: 'Veterano',
      description: 'Registra 25 entrenamientos',
      icon: 'barbell',
      unlocked: totalWorkouts >= 25,
    },
  ];
}

/** Marcas históricas de un ejercicio: mejor peso y mejores reps sin lastre. */
export interface ExerciseBest {
  bestWeightKg: number;
  bestRepsAtWeight: number;
  bestReps: number;
}

function parseReps(reps: string): number {
  const n = parseInt(reps, 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Mejores marcas históricas por ejercicio a partir del historial. */
export function bestsByExercise(logs: WorkoutLog[]): Record<string, ExerciseBest> {
  const bests: Record<string, ExerciseBest> = {};
  for (const log of logs) {
    for (const ex of log.exercises) {
      const b = (bests[ex.exerciseId] ??= { bestWeightKg: 0, bestRepsAtWeight: 0, bestReps: 0 });
      for (const set of ex.sets) {
        if (!set.completed) continue;
        const w = toNum(set.weight) || 0;
        const r = parseReps(set.reps);
        if (w > b.bestWeightKg || (w === b.bestWeightKg && r > b.bestRepsAtWeight)) {
          if (w > 0) {
            b.bestWeightKg = w;
            b.bestRepsAtWeight = r;
          }
        }
        if (r > b.bestReps) b.bestReps = r;
      }
    }
  }
  return bests;
}

export interface PersonalRecord {
  exerciseName: string;
  /** Descripción corta del récord, p.ej. "12 kg × 8" o "15 reps". */
  label: string;
}

/**
 * Compara la sesión recién completada con las mejores marcas históricas y
 * devuelve los récords personales conseguidos hoy (más peso, o más reps con
 * el mismo peso / sin lastre).
 */
export function detectNewPRs(
  history: WorkoutLog[],
  session: LoggedExercise[]
): PersonalRecord[] {
  const bests = bestsByExercise(history);
  const prs: PersonalRecord[] = [];

  for (const ex of session) {
    const b = bests[ex.exerciseId] ?? { bestWeightKg: 0, bestRepsAtWeight: 0, bestReps: 0 };
    const unit = ex.measure === 'seconds' ? 's' : 'reps';
    let record: PersonalRecord | null = null;
    for (const set of ex.sets) {
      if (!set.completed) continue;
      const w = toNum(set.weight) || 0;
      const r = parseReps(set.reps);
      if (w > 0 && (w > b.bestWeightKg || (w === b.bestWeightKg && r > b.bestRepsAtWeight))) {
        record = { exerciseName: ex.name, label: `${w} kg × ${r || '—'}` };
      } else if (w === 0 && b.bestReps > 0 && r > b.bestReps) {
        record = { exerciseName: ex.name, label: `${r} ${unit}` };
      }
    }
    if (record) prs.push(record);
  }
  return prs;
}

/** Métricas agregadas de una sesión para el resumen post-entreno. */
/**
 * Un ejercicio es isométrico si su medida guardada es 'seconds' O si la medida
 * ACTUAL en la biblioteca del entrenador (mapa opcional) lo es. Así una plancha
 * marcada como segundos se muestra en segundos aunque el registro sea antiguo.
 */
export function isIsometricExercise(
  ex: LoggedExercise,
  measureByExercise?: Record<string, string>
): boolean {
  return ex.measure === 'seconds' || measureByExercise?.[ex.exerciseId] === 'seconds';
}

export function sessionTotals(
  session: LoggedExercise[],
  measureByExercise?: Record<string, string>
) {
  let sets = 0;
  let reps = 0;
  let seconds = 0;
  let volumeKg = 0;
  for (const ex of session) {
    const isSeconds = isIsometricExercise(ex, measureByExercise);
    for (const set of ex.sets) {
      if (!set.completed) continue;
      const r = parseReps(set.reps);
      sets += 1;
      // Reps de ejercicios por repeticiones; segundos de los isométricos.
      if (isSeconds) seconds += r;
      else reps += r;
      volumeKg += (toNum(set.weight) || 0) * r;
    }
  }
  return { sets, reps, seconds, volumeKg: Math.round(volumeKg) };
}

/**
 * Resumen semanal del grupo para el coach: sesiones de esta semana vs la
 * anterior y cuántos alumnos distintos han entrenado esta semana.
 */
export function weekComparison(logs: WorkoutLog[]): {
  thisWeek: number;
  lastWeek: number;
  activeClients: number;
} {
  const currentWeek = startOfWeek(Date.now());
  const previousWeek = addDays(currentWeek, -7);
  let thisWeek = 0;
  let lastWeek = 0;
  const active = new Set<string>();
  for (const log of logs) {
    const week = startOfWeek(log.date);
    if (week === currentWeek) {
      thisWeek += 1;
      active.add(log.clientId);
    } else if (week === previousWeek) {
      lastWeek += 1;
    }
  }
  return { thisWeek, lastWeek, activeClients: active.size };
}

export interface WeeklySetsByGroup {
  weekStart: number;
  pushSets: number;
  pullSets: number;
}

/**
 * Series COMPLETADAS por semana separadas por patrón: empuje (grupo muscular
 * 'Empuje') y tirón ('Tirón'). El mapa exerciseId → grupo muscular viene de la
 * biblioteca del entrenador (el registro de la serie no guarda el grupo).
 */
export function weeklySetsByGroup(
  logs: WorkoutLog[],
  muscleByExercise: Record<string, string>,
  weeks = 8
): WeeklySetsByGroup[] {
  const currentWeek = startOfWeek(Date.now());
  const result: WeeklySetsByGroup[] = Array.from({ length: weeks }, (_, i) => ({
    weekStart: addDays(currentWeek, -7 * (weeks - 1 - i)),
    pushSets: 0,
    pullSets: 0,
  }));
  const index = new Map(result.map((r, i) => [r.weekStart, i]));
  for (const log of logs) {
    const i = index.get(startOfWeek(log.date));
    if (i === undefined) continue;
    const bucket = result[i];
    for (const ex of log.exercises) {
      const group = muscleByExercise[ex.exerciseId];
      if (group !== 'Empuje' && group !== 'Tirón') continue;
      const done = ex.sets.filter((s) => s.completed).length;
      if (group === 'Empuje') bucket.pushSets += done;
      else bucket.pullSets += done;
    }
  }
  return result;
}

/**
 * Mapa muscular: series completadas por grupo muscular en los últimos `days`
 * días, ordenado de mayor a menor. Grupos sin biblioteca → "Otros".
 */
export function setsByMuscleGroup(
  logs: WorkoutLog[],
  muscleByExercise: Record<string, string>,
  days = 28
): { group: string; sets: number }[] {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const totals = new Map<string, number>();
  for (const log of logs) {
    if (log.date < since) continue;
    for (const ex of log.exercises) {
      const group = muscleByExercise[ex.exerciseId] ?? 'Otros';
      const done = ex.sets.filter((s) => s.completed).length;
      if (done > 0) totals.set(group, (totals.get(group) ?? 0) + done);
    }
  }
  return [...totals]
    .map(([group, sets]) => ({ group, sets }))
    .sort((a, b) => b.sets - a.sets);
}

export interface MonthlyWorkouts {
  key: string;
  label: string;
  monthStart: number;
  sessions: WorkoutLog[];
  totalSets: number;
  totalReps: number;
  totalSeconds: number;
  volumeKg: number;
}

/**
 * Agrupa los entrenamientos por mes (más reciente primero), con el total de
 * series, reps, segundos isométricos y volumen de cada mes. Es el "registro de
 * entrenamiento mensual" del alumno.
 */
export function workoutsByMonth(
  logs: WorkoutLog[],
  measureByExercise?: Record<string, string>
): MonthlyWorkouts[] {
  const map = new Map<string, MonthlyWorkouts>();
  for (const log of logs) {
    const d = new Date(log.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    let m = map.get(key);
    if (!m) {
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      m = {
        key,
        label: new Date(monthStart).toLocaleDateString('es-ES', {
          month: 'long',
          year: 'numeric',
        }),
        monthStart,
        sessions: [],
        totalSets: 0,
        totalReps: 0,
        totalSeconds: 0,
        volumeKg: 0,
      };
      map.set(key, m);
    }
    m.sessions.push(log);
    const t = sessionTotals(log.exercises, measureByExercise);
    m.totalSets += t.sets;
    m.totalReps += t.reps;
    m.totalSeconds += t.seconds;
    m.volumeKg += t.volumeKg;
  }
  const months = [...map.values()].sort((a, b) => b.monthStart - a.monthStart);
  for (const m of months) m.sessions.sort((a, b) => b.date - a.date);
  return months;
}

/** Actividad agregada por semana (últimas `weeks`), para gráficas. */
export function weeklyActivity(
  logs: WorkoutLog[],
  weeks = 8
): { weekStart: number; sessions: number; volumeKg: number }[] {
  const currentWeek = startOfWeek(Date.now());
  const result = Array.from({ length: weeks }, (_, i) => ({
    weekStart: addDays(currentWeek, -7 * (weeks - 1 - i)),
    sessions: 0,
    volumeKg: 0,
  }));
  const index = new Map(result.map((r, i) => [r.weekStart, i]));
  for (const log of logs) {
    const i = index.get(startOfWeek(log.date));
    if (i === undefined) continue;
    result[i].sessions += 1;
    result[i].volumeKg += sessionTotals(log.exercises).volumeKg;
  }
  return result;
}

export interface WeeklyVolumePoint {
  weekStart: number;
  /** Volumen en kg (peso × reps) de los ejercicios por repeticiones. */
  volumeKg: number;
  /** Segundos totales de trabajo isométrico (ejercicios medidos en segundos). */
  isoSeconds: number;
  /** Segundos isométricos de empuje (grupo muscular 'Empuje'). */
  isoPushSeconds: number;
  /** Segundos isométricos de tirón (grupo muscular 'Tirón'). */
  isoPullSeconds: number;
}

/**
 * Volumen semanal ampliado. Además del volumen en kg (peso × reps de los
 * ejercicios por repeticiones), suma los SEGUNDOS totales de trabajo
 * isométrico (ejercicios medidos en segundos, donde el valor va en `reps`),
 * separando empuje de tirón según el grupo muscular del ejercicio. El mapa
 * `muscleByExercise` (exerciseId → grupo muscular) proviene de la biblioteca
 * del entrenador, ya que el registro de la serie no guarda el grupo.
 */
export function weeklyVolume(
  logs: WorkoutLog[],
  muscleByExercise: Record<string, string> = {},
  weeks = 8
): WeeklyVolumePoint[] {
  const currentWeek = startOfWeek(Date.now());
  const result: WeeklyVolumePoint[] = Array.from({ length: weeks }, (_, i) => ({
    weekStart: addDays(currentWeek, -7 * (weeks - 1 - i)),
    volumeKg: 0,
    isoSeconds: 0,
    isoPushSeconds: 0,
    isoPullSeconds: 0,
  }));
  const index = new Map(result.map((r, i) => [r.weekStart, i]));
  for (const log of logs) {
    const i = index.get(startOfWeek(log.date));
    if (i === undefined) continue;
    const bucket = result[i];
    for (const ex of log.exercises) {
      const group = muscleByExercise[ex.exerciseId];
      const isIso = ex.measure === 'seconds';
      for (const set of ex.sets) {
        if (!set.completed) continue;
        const n = parseReps(set.reps);
        if (isIso) {
          bucket.isoSeconds += n;
          if (group === 'Empuje') bucket.isoPushSeconds += n;
          else if (group === 'Tirón') bucket.isoPullSeconds += n;
        } else {
          bucket.volumeKg += (toNum(set.weight) || 0) * n;
        }
      }
    }
  }
  for (const r of result) r.volumeKg = Math.round(r.volumeKg);
  return result;
}

/** Ejercicios más entrenados (por nº de sesiones en que aparecen). */
export function topExercises(logs: WorkoutLog[], n = 5): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const log of logs) {
    const seen = new Set<string>();
    for (const ex of log.exercises) {
      if (seen.has(ex.exerciseId)) continue;
      seen.add(ex.exerciseId);
      counts.set(ex.name, (counts.get(ex.name) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

/** Días (timestamp a medianoche) con al menos un entrenamiento. */
export function trainingDays(logs: WorkoutLog[]): Set<number> {
  return new Set(logs.map((l) => startOfDay(l.date)));
}

/** Ejercicios que aparecen en el historial (id + nombre), más recientes primero. */
export interface PeriodSnapshot {
  sessions: number;
  sets: number;
  volumeKg: number;
  weightKg: number | null;
}

/**
 * Comparador "tú hace 3 meses → hoy": últimos 28 días frente a la misma
 * ventana de 28 días hace 3 meses. null si entonces no había datos (alumno
 * nuevo): la tarjeta simplemente no se muestra.
 */
export function thenVsNow(
  logs: WorkoutLog[],
  weights: WeightLog[]
): { then: PeriodSnapshot; now: PeriodSnapshot } | null {
  const DAY = 24 * 60 * 60 * 1000;
  const nowTs = Date.now();
  const snapshot = (from: number, to: number): PeriodSnapshot => {
    let sessions = 0;
    let sets = 0;
    let volumeKg = 0;
    for (const log of logs) {
      if (log.date < from || log.date > to) continue;
      sessions += 1;
      const t = sessionTotals(log.exercises);
      sets += t.sets;
      volumeKg += t.volumeKg;
    }
    // Peso corporal al final de la ventana (último registro hasta esa fecha).
    let weightKg: number | null = null;
    for (const w of weights) {
      if (w.date <= to) weightKg = w.weightKg;
    }
    return { sessions, sets, volumeKg: Math.round(volumeKg), weightKg };
  };
  const then = snapshot(nowTs - 112 * DAY, nowTs - 84 * DAY);
  if (then.sessions === 0) return null;
  return { then, now: snapshot(nowTs - 28 * DAY, nowTs) };
}

/**
 * Ritmo de progreso: pendiente (unidades por mes de 30 días) por regresión
 * lineal simple sobre los puntos de un ejercicio. null si no hay base (<3).
 */
export function trendPerMonth(points: { date: number; value: number }[]): number | null {
  if (points.length < 3) return null;
  const MONTH = 30 * 24 * 60 * 60 * 1000;
  const t0 = points[0].date;
  const xs = points.map((p) => (p.date - t0) / MONTH);
  const ys = points.map((p) => p.value);
  const n = points.length;
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sxx = xs.reduce((a, x) => a + x * x, 0);
  const den = n * sxx - sx * sx;
  if (Math.abs(den) < 1e-9) return null;
  return (n * sxy - sx * sy) / den;
}

export function listExercisesInLogs(logs: WorkoutLog[]): { exerciseId: string; name: string }[] {
  const map = new Map<string, string>();
  const sorted = [...logs].sort((a, b) => b.date - a.date);
  for (const log of sorted) {
    for (const ex of log.exercises) {
      if (!map.has(ex.exerciseId)) map.set(ex.exerciseId, ex.name);
    }
  }
  return Array.from(map, ([exerciseId, name]) => ({ exerciseId, name }));
}

export interface ExerciseProgressPoint {
  date: number;
  reps: number;
  weight: number;
}
export interface ExerciseProgress {
  exerciseId: string;
  name: string;
  measure: 'reps' | 'seconds';
  hasWeight: boolean;
  points: ExerciseProgressPoint[];
}

/**
 * Progresión de un ejercicio a lo largo del tiempo: por cada sesión en que se
 * hizo, la mejor serie (más reps/segundos y más peso). Ideal para ver mejoras.
 */
export function exerciseProgression(
  logs: WorkoutLog[],
  exerciseId: string
): ExerciseProgress | null {
  const sorted = [...logs].sort((a, b) => a.date - b.date);
  const points: ExerciseProgressPoint[] = [];
  let name = '';
  let measure: 'reps' | 'seconds' = 'reps';
  let hasWeight = false;
  for (const log of sorted) {
    const ex = log.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex) continue;
    name = ex.name;
    if (ex.measure) measure = ex.measure;
    let bestReps = 0;
    let bestWeight = 0;
    for (const set of ex.sets) {
      if (!set.completed) continue;
      const r = parseInt(set.reps, 10);
      if (!Number.isNaN(r)) bestReps = Math.max(bestReps, r);
      const w = toNum(set.weight);
      if (set.weight && !Number.isNaN(w)) {
        bestWeight = Math.max(bestWeight, w);
        if (w > 0) hasWeight = true;
      }
    }
    points.push({ date: log.date, reps: bestReps, weight: bestWeight });
  }
  if (points.length === 0) return null;
  return { exerciseId, name, measure, hasWeight, points };
}
