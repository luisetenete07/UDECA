import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * LA FOTO DE CADA REGISTRO DE PESO.
 *
 * Va en su propio documento (`progressPhotos/<id del registro de peso>`) y no
 * dentro del registro: la lista de pesos se lee entera cada vez que se abre
 * Nutrición, y con una foto de 100 KB en cada registro, un año pesándose cada
 * semana serían 5 MB para pintar una gráfica. Así la lista sigue siendo
 * ligera y cada foto se pide solo cuando se va a ver.
 *
 * `progressPhotos` es la colección de las fotos de progreso de antes: ya tenía
 * sus reglas (la sube el alumno, la ven él y su entrenador, la borra él) y ya
 * se borra al eliminar la cuenta.
 */
const ref = (logId: string) => doc(db, 'progressPhotos', logId);

export async function guardarFotoDePeso(
  logId: string,
  datos: { clientId: string; trainerId: string; date: number; foto: string }
): Promise<void> {
  await setDoc(ref(logId), {
    clientId: datos.clientId,
    trainerId: datos.trainerId,
    date: datos.date,
    weightLogId: logId,
    imageURL: datos.foto,
    createdAt: Date.now(),
  });
}

/** La foto de un registro, o null si no tiene (o no se puede leer). */
export async function fotoDePeso(logId: string): Promise<string | null> {
  try {
    const snap = await getDoc(ref(logId));
    const url = snap.exists() ? snap.data()?.imageURL : null;
    return typeof url === 'string' && url ? url : null;
  } catch {
    return null;
  }
}

export async function borrarFotoDePeso(logId: string): Promise<void> {
  await deleteDoc(ref(logId)).catch(() => {});
}
