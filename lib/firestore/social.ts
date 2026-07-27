import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { getActiveChallenge } from './challenges';
import {
  bestStreakInMonth,
  currentStreak,
  monthKeyOf,
  monthStartOf,
  sessionsThisWeek,
  weekKeyOf,
  workoutsInMonth,
} from '../stats';
import type { SocialStats, UserProfile, WorkoutLog } from '../types';

const collectionRef = () => collection(db, 'socialStats');

/**
 * Escribe/actualiza el documento público de estadísticas del propio usuario
 * a partir de sus entrenamientos. Solo incluye métricas no sensibles.
 */
export async function syncMySocialStats(
  profile: UserProfile,
  workoutLogs: WorkoutLog[],
  lastPR?: { exerciseName: string; label: string; date: number }
): Promise<SocialStats | null> {
  if (!profile.trainerId) return null;

  // Sesiones dentro del periodo del reto activo del grupo (si lo hay).
  let challengeSessions: number | undefined;
  try {
    const challenge = await getActiveChallenge(profile.trainerId);
    if (challenge) {
      challengeSessions = workoutLogs.filter(
        (l) => l.date >= challenge.startDate && l.date <= challenge.endDate
      ).length;
    }
  } catch {
    // El ranking del reto es secundario: no bloquea la sincronización.
  }

  // Métricas mensuales (se reinician cada mes) + mejor racha del mes anterior
  // para el podio del cambio de mes. Todo se recalcula desde los propios logs.
  const now = Date.now();
  const lastMonthRef = monthStartOf(now) - 1; // un instante dentro del mes previo

  const stats: SocialStats = {
    uid: profile.uid,
    trainerId: profile.trainerId,
    name: profile.name,
    photoURL: profile.photoURL,
    level: profile.level,
    currentStreak: currentStreak(workoutLogs),
    sessionsThisWeek: sessionsThisWeek(workoutLogs),
    totalWorkouts: workoutLogs.length,
    streakThisMonth: currentStreak(workoutLogs, undefined, monthStartOf(now)),
    workoutsThisMonth: workoutsInMonth(workoutLogs, now),
    lastMonthStreak: bestStreakInMonth(workoutLogs, lastMonthRef),
    monthKey: monthKeyOf(now),
    weekKey: weekKeyOf(now),
    challengeSessions: challengeSessions ?? 0,
    // Nuevo récord de esta sesión; si no lo hay, merge conserva el anterior.
    lastPR,
    updatedAt: now,
  };
  // Firestore rechaza campos `undefined`; los omitimos.
  const clean = Object.fromEntries(
    Object.entries(stats).filter(([, v]) => v !== undefined)
  ) as SocialStats;
  // merge: los campos no incluidos (p. ej. lastPR previo) se conservan.
  await setDoc(doc(db, 'socialStats', profile.uid), clean, { merge: true });
  return clean;
}

/**
 * El entrenador elimina la entrada de un alumno de la clasificación (borra su
 * doc de socialStats). Útil para limpiar perfiles antiguos o de prueba. Si el
 * alumno sigue activo y vuelve a abrir la app, reaparecerá con la presencia.
 */
export async function deleteSocialStats(uid: string): Promise<void> {
  await deleteDoc(doc(db, 'socialStats', uid));
}

/** Ranking de miembros del mismo entrenador, ordenado por racha y sesiones. */
export async function getSocialLeaderboard(trainerId: string): Promise<SocialStats[]> {
  const snap = await getDocs(leaderboardQuery(trainerId));
  return mapLeaderboard(snap);
}

/**
 * Igual que `getSocialLeaderboard` pero en vivo: reenvía el ranking cada vez
 * que cambia cualquier ficha del grupo (racha, entrenos, nivel, alta de un
 * alumno nuevo...). Devuelve la función para darse de baja.
 */
export function subscribeSocialLeaderboard(
  trainerId: string,
  onChange: (rows: SocialStats[]) => void,
  onError?: (error: Error) => void
): () => void {
  return onSnapshot(
    leaderboardQuery(trainerId),
    (snap) => onChange(mapLeaderboard(snap)),
    (error) => onError?.(error)
  );
}

function leaderboardQuery(trainerId: string) {
  return query(collectionRef(), where('trainerId', '==', trainerId));
}

function mapLeaderboard(snap: QuerySnapshot<DocumentData>): SocialStats[] {
  const nowMonth = monthKeyOf(Date.now());
  const nowWeek = weekKeyOf(Date.now());
  return snap.docs
    .map((d) => {
      const s = d.data() as SocialStats;
      // Las métricas MENSUALES solo son de fiar si la ficha se sincronizó ESTE
      // mes. Si es de un mes anterior (o de una versión vieja sin monthKey), se
      // muestran a 0 hasta que el alumno abra la app y se recalculen. Así nunca
      // aparece la incoherencia "racha 2 días · 0 entrenos este mes" (que venía
      // de mezclar la racha global con un conteo mensual vacío).
      const fresh = s.monthKey === nowMonth;
      // Lo mismo con las SEMANALES: la semana termina el domingo a las 23:59,
      // así que una ficha sincronizada antes de ese corte cuenta como 0 hasta
      // que el alumno vuelva a abrir la app.
      const freshWeek = s.weekKey === nowWeek;
      return {
        ...s,
        currentStreak: s.currentStreak ?? 0,
        sessionsThisWeek: freshWeek ? s.sessionsThisWeek ?? 0 : 0,
        totalWorkouts: s.totalWorkouts ?? 0,
        streakThisMonth: fresh ? s.streakThisMonth ?? 0 : 0,
        workoutsThisMonth: fresh ? s.workoutsThisMonth ?? 0 : 0,
        lastMonthStreak: s.lastMonthStreak ?? 0,
        challengeSessions: s.challengeSessions ?? 0,
      } as SocialStats;
    })
    .sort(compareLeaderboard);
}

/**
 * Orden del ranking: racha → sesiones de la semana → entrenos totales, y por
 * nombre para desempatar (orden estable). Los campos que aún no se hayan
 * sincronizado (p. ej. un alumno que abrió la app pero no ha entrenado, cuyo
 * doc solo tiene la presencia) cuentan como 0, de modo que quien no ha
 * entrenado nunca queda por encima de quien sí lo ha hecho.
 */
export function compareLeaderboard(a: SocialStats, b: SocialStats): number {
  return (
    (b.streakThisMonth ?? b.currentStreak ?? 0) - (a.streakThisMonth ?? a.currentStreak ?? 0) ||
    (b.workoutsThisMonth ?? 0) - (a.workoutsThisMonth ?? 0) ||
    (b.sessionsThisWeek ?? 0) - (a.sessionsThisWeek ?? 0) ||
    (a.name ?? '').localeCompare(b.name ?? '')
  );
}
