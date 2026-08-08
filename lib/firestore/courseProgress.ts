import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { LessonsSeen } from '../courseProgress';

/**
 * Qué lecciones ha visto cada alumno. Doc id = uid del alumno.
 *
 * Un solo documento por alumno con un mapa `{ courseId: [lessonId, ...] }`, y
 * no un documento por alumno y curso. El panel del entrenador necesita el
 * avance de TODOS sus alumnos de golpe: con un documento por par serían
 * alumnos × cursos lecturas cada vez que abre la app, y el panel tiene que
 * pintarse en un parpadeo.
 *
 * Lo escribe el propio alumno y solo él: si su entrenador pudiera marcarle
 * lecciones como vistas, el dato dejaría de significar lo que dice. Las reglas
 * lo impiden en los dos sentidos.
 */
export interface CourseProgress {
  uid: string;
  lessons: LessonsSeen;
  updatedAt: number;
}

const ref = (uid: string) => doc(db, 'courseProgress', uid);

export async function getCourseProgress(uid: string): Promise<LessonsSeen> {
  try {
    const snap = await getDoc(ref(uid));
    if (!snap.exists()) return {};
    const l = snap.data().lessons;
    return l && typeof l === 'object' ? (l as LessonsSeen) : {};
  } catch {
    // Sin permiso o sin documento, la pantalla se pinta igual: sin marcas.
    // Un curso que no carga es peor que un curso sin porcentaje.
    return {};
  }
}

/**
 * El avance de varios alumnos, para el panel. Los que fallen salen vacíos.
 *
 * Se piden en tandas de 30 —el tope de la cláusula `in` de Firestore— en vez de
 * uno a uno. Con cuarenta alumnos son dos viajes en lugar de cuarenta, y el
 * panel del entrenador es justo la pantalla que tiene que aparecer de golpe.
 *
 * Si la consulta agrupada falla (las reglas de este proyecto comprueban el
 * vínculo alumno-entrenador documento a documento, y eso no siempre se puede
 * resolver en una consulta), se vuelve a la forma de uno en uno. Preferir la
 * rápida y saber caer a la lenta es mejor que elegir la lenta siempre: el fallo
 * silencioso aquí sería enseñar 0 % a todo el grupo, que parece culpa de los
 * alumnos.
 */
export async function getCourseProgressMany(
  uids: string[]
): Promise<Record<string, LessonsSeen>> {
  if (uids.length === 0) return {};

  const unoAUno = async () => {
    const pares = await Promise.all(
      uids.map(async (uid) => [uid, await getCourseProgress(uid)] as const)
    );
    return Object.fromEntries(pares);
  };

  try {
    const salida: Record<string, LessonsSeen> = {};
    for (const uid of uids) salida[uid] = {};
    for (let i = 0; i < uids.length; i += 30) {
      const tanda = uids.slice(i, i + 30);
      const snap = await getDocs(
        query(collection(db, 'courseProgress'), where(documentId(), 'in', tanda))
      );
      for (const d of snap.docs) {
        const l = d.data().lessons;
        salida[d.id] = l && typeof l === 'object' ? (l as LessonsSeen) : {};
      }
    }
    return salida;
  } catch {
    return unoAUno();
  }
}

/**
 * Guarda las lecciones vistas de UN curso. El `merge` solo toca esa clave del
 * mapa, así que marcar algo en un curso no puede borrar el avance de otro.
 */
export async function setLessonsSeen(
  uid: string,
  courseId: string,
  lessonIds: string[]
): Promise<void> {
  await setDoc(
    ref(uid),
    { uid, lessons: { [courseId]: lessonIds }, updatedAt: Date.now() },
    { merge: true }
  );
}
