import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { getActiveChallenge } from './challenges';
import { currentStreak, sessionsThisWeek } from '../stats';
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

  const stats: SocialStats = {
    uid: profile.uid,
    trainerId: profile.trainerId,
    name: profile.name,
    photoURL: profile.photoURL,
    level: profile.level,
    currentStreak: currentStreak(workoutLogs),
    sessionsThisWeek: sessionsThisWeek(workoutLogs),
    totalWorkouts: workoutLogs.length,
    challengeSessions: challengeSessions ?? 0,
    // Nuevo récord de esta sesión; si no lo hay, merge conserva el anterior.
    lastPR,
    updatedAt: Date.now(),
  };
  // Firestore rechaza campos `undefined`; los omitimos.
  const clean = Object.fromEntries(
    Object.entries(stats).filter(([, v]) => v !== undefined)
  ) as SocialStats;
  // merge: los campos no incluidos (p. ej. lastPR previo) se conservan.
  await setDoc(doc(db, 'socialStats', profile.uid), clean, { merge: true });
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
    (b.currentStreak ?? 0) - (a.currentStreak ?? 0) ||
    (b.sessionsThisWeek ?? 0) - (a.sessionsThisWeek ?? 0) ||
    (b.totalWorkouts ?? 0) - (a.totalWorkouts ?? 0) ||
    (a.name ?? '').localeCompare(b.name ?? '')
  );
}
