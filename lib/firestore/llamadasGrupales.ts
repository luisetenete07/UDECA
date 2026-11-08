import { addDoc, collection, deleteDoc, deleteField, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebase';
import { grupalParaGuardar, type BorradorDeGrupal, type LlamadaGrupal } from '../llamadaGrupal';

/*
 * Las llamadas grupales en Firestore (`llamadasGrupales/{auto}`, la lógica en
 * lib/llamadaGrupal.ts).
 *
 * Las crea, cambia y borra el entrenador. Las leen él y sus alumnos: todos los
 * que lo tienen de entrenador, también los que lleguen después de crearla.
 */

const deGrupal = (id: string, d: Record<string, unknown>): LlamadaGrupal => ({
  id,
  trainerId: String(d.trainerId ?? ''),
  titulo: String(d.titulo ?? ''),
  ...(typeof d.nota === 'string' && d.nota ? { nota: d.nota } : {}),
  ...(typeof d.enlace === 'string' && d.enlace ? { enlace: d.enlace } : {}),
  inicio: Number(d.inicio ?? 0),
  duracionMin: Number(d.duracionMin ?? 60),
  diasAntes: Number(d.diasAntes ?? 0),
  createdAt: Number(d.createdAt ?? 0),
});

/** Las de un entrenador que empiezan desde `desde`, la más próxima primero. */
export async function getLlamadasGrupales(trainerId: string, desde: number): Promise<LlamadaGrupal[]> {
  const snap = await getDocs(
    query(collection(db, 'llamadasGrupales'), where('trainerId', '==', trainerId), where('inicio', '>=', desde))
  );
  return snap.docs.map((x) => deGrupal(x.id, x.data())).sort((a, b) => a.inicio - b.inicio);
}

export async function crearLlamadaGrupal(trainerId: string, b: BorradorDeGrupal): Promise<LlamadaGrupal> {
  const datos = { trainerId, ...grupalParaGuardar(b), createdAt: Date.now() };
  const ref = await addDoc(collection(db, 'llamadasGrupales'), datos);
  return { id: ref.id, ...datos };
}

/** Cambia una. La nota o el enlace que se dejan vacíos se BORRAN (no se quedan los de antes). */
export async function editarLlamadaGrupal(id: string, b: BorradorDeGrupal): Promise<void> {
  const limpio = grupalParaGuardar(b);
  await updateDoc(doc(db, 'llamadasGrupales', id), {
    ...limpio,
    ...(limpio.nota ? {} : { nota: deleteField() }),
    ...(limpio.enlace ? {} : { enlace: deleteField() }),
  });
}

export async function borrarLlamadaGrupal(id: string): Promise<void> {
  await deleteDoc(doc(db, 'llamadasGrupales', id));
}
