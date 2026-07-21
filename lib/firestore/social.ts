import { collection, deleteDoc, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { getActiveChallenge } from './challenges';
import {
  bestStreakInMonth,
  currentStreak,
  monthKeyOf,
  monthStartOf,
  sessionsThisWeek,
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
) {
  if (!profile.trainerId) return;

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
  const q = query(collectionRef(), where('trainerId', '==', trainerId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => {
      const s = d.data() as SocialStats;
      // Normaliza: los docs creados solo por la presencia no traen métricas de
      // entreno. Sin esto, "undefined" rompe el orden y se ve en la lista.
      return {
        ...s,
        currentStreak: s.currentStreak ?? 0,
        sessionsThisWeek: s.sessionsThisWeek ?? 0,
        totalWorkouts: s.totalWorkouts ?? 0,
        // Compat.: docs antiguos sin métricas mensuales caen a las de siempre.
        streakThisMonth: s.streakThisMonth ?? s.currentStreak ?? 0,
        workoutsThisMonth: s.workoutsThisMonth ?? 0,
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
function compareLeaderboard(a: SocialStats, b: SocialStats): number {
  return (
    (b.streakThisMonth ?? b.currentStreak ?? 0) - (a.streakThisMonth ?? a.currentStreak ?? 0) ||
    (b.workoutsThisMonth ?? 0) - (a.workoutsThisMonth ?? 0) ||
    (b.sessionsThisWeek ?? 0) - (a.sessionsThisWeek ?? 0) ||
    (a.name ?? '').localeCompare(b.name ?? '')
  );
}
