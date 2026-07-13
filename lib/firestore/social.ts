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
    .map((d) => d.data() as SocialStats)
    .sort(
      (a, b) =>
        b.currentStreak - a.currentStreak ||
        b.sessionsThisWeek - a.sessionsThisWeek ||
        b.totalWorkouts - a.totalWorkouts
    );
}
