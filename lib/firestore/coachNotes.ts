import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Nota privada del entrenador sobre un alumno (lesiones, preferencias...).
 * Solo la ve y edita el entrenador. Doc id = clientId.
 */
export async function getCoachNote(clientId: string): Promise<string> {
  const snap = await getDoc(doc(db, 'coachNotes', clientId));
  return snap.exists() ? ((snap.data().text as string) ?? '') : '';
}

export async function saveCoachNote(trainerId: string, clientId: string, text: string) {
  await setDoc(
    doc(db, 'coachNotes', clientId),
    { trainerId, clientId, text, updatedAt: Date.now() },
    { merge: true }
  );
}
