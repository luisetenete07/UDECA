import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { UserProfile } from './types';

/**
 * Presencia ligera: el alumno marca "estoy en la app" escribiendo lastSeen en
 * su doc de socialStats (que su coach ya puede leer). Se limita a una escritura
 * cada 4 minutos para no gastar operaciones.
 */
const HEARTBEAT_MS = 4 * 60 * 1000;
let lastBeat = 0;

export function markPresence(profile: UserProfile): void {
  if (!profile.trainerId) return;
  const now = Date.now();
  if (now - lastBeat < HEARTBEAT_MS) return;
  lastBeat = now;
  setDoc(
    doc(db, 'socialStats', profile.uid),
    {
      uid: profile.uid,
      trainerId: profile.trainerId,
      name: profile.name,
      ...(profile.photoURL ? { photoURL: profile.photoURL } : {}),
      lastSeen: now,
      updatedAt: now,
    },
    { merge: true }
  ).catch(() => {
    lastBeat = 0; // reintenta en el siguiente evento
  });
}

/** ¿Se considera "en línea"? (activo en los últimos 5 minutos) */
export function isOnline(lastSeen?: number, now = Date.now()): boolean {
  return !!lastSeen && now - lastSeen < 5 * 60 * 1000;
}
