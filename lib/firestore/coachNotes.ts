import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Nota privada del entrenador sobre un alumno (lesiones, preferencias...).
 * Solo la ve y edita el entrenador. Doc id = clientId.
 */
export async function getCoachNote(clientId: string): Promise<string> {
  try {
    const snap = await getDoc(doc(db, 'coachNotes', clientId));
    return snap.exists() ? ((snap.data().text as string) ?? '') : '';
  } catch {
    // Si el alumno aún no tiene nota, el documento no existe y las reglas
    // (que comprueban `resource.data.trainerId`) deniegan la lectura de un
    // documento inexistente. Eso no debe impedir cargar el perfil: sin nota.
    return '';
  }
}

export async function saveCoachNote(trainerId: string, clientId: string, text: string) {
  await setDoc(
    doc(db, 'coachNotes', clientId),
    { trainerId, clientId, text, updatedAt: Date.now() },
    { merge: true }
  );
}
