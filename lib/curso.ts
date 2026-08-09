import { nuevoId } from './ids';
import type { Course, CourseSection, Lesson, MiniClase } from './types';

/**
 * Operaciones sobre el árbol de un curso: secciones, lecciones y mini clases.
 *
 * Están aquí y no dentro de la pantalla del editor porque mover un elemento de
 * sitio en un árbol de tres niveles es de esas cosas que parecen triviales y
 * que se rompen por los bordes —el primero, el último, la lista de uno—, y
 * porque lo que se rompe es el curso de alguien: el orden en que el entrenador
 * dejó sus lecciones es su trabajo, no un detalle de la interfaz.
 */

/** Mueve un elemento de una lista. Fuera de rango, la deja como está. */
export function movido<T>(lista: T[], de: number, a: number): T[] {
  if (de === a || de < 0 || a < 0 || de >= lista.length || a >= lista.length) return lista;
  const copia = [...lista];
  const [x] = copia.splice(de, 1);
  copia.splice(a, 0, x);
  return copia;
}

/** Aplica un cambio a una sección concreta, dejando las demás intactas. */
function enSeccion(
  secciones: CourseSection[],
  sectionId: string,
  cambio: (s: CourseSection) => CourseSection
): CourseSection[] {
  return secciones.map((s) => (s.id === sectionId ? cambio(s) : s));
}

/** Aplica un cambio a una lección concreta. */
function enLeccion(
  secciones: CourseSection[],
  sectionId: string,
  lessonId: string,
  cambio: (l: Lesson) => Lesson
): CourseSection[] {
  return enSeccion(secciones, sectionId, (s) => ({
    ...s,
    lessons: s.lessons.map((l) => (l.id === lessonId ? cambio(l) : l)),
  }));
}

export function seccionesReordenadas(
  secciones: CourseSection[],
  de: number,
  a: number
): CourseSection[] {
  return movido(secciones, de, a);
}

export function leccionesReordenadas(
  secciones: CourseSection[],
  sectionId: string,
  de: number,
  a: number
): CourseSection[] {
  return enSeccion(secciones, sectionId, (s) => ({ ...s, lessons: movido(s.lessons, de, a) }));
}

export function minisReordenadas(
  secciones: CourseSection[],
  sectionId: string,
  lessonId: string,
  de: number,
  a: number
): CourseSection[] {
  return enLeccion(secciones, sectionId, lessonId, (l) => ({
    ...l,
    minis: movido(l.minis ?? [], de, a),
  }));
}

/** Cambia un campo de una lección. */
export function conLeccionCambiada(
  secciones: CourseSection[],
  sectionId: string,
  lessonId: string,
  campos: Partial<Lesson>
): CourseSection[] {
  return enLeccion(secciones, sectionId, lessonId, (l) => ({ ...l, ...campos }));
}

/** Cambia un campo de una mini clase. */
export function conMiniCambiada(
  secciones: CourseSection[],
  sectionId: string,
  lessonId: string,
  miniId: string,
  campos: Partial<MiniClase>
): CourseSection[] {
  return enLeccion(secciones, sectionId, lessonId, (l) => ({
    ...l,
    minis: (l.minis ?? []).map((m) => (m.id === miniId ? { ...m, ...campos } : m)),
  }));
}

export function conMiniNueva(
  secciones: CourseSection[],
  sectionId: string,
  lessonId: string
): CourseSection[] {
  const mini: MiniClase = { id: nuevoId(), title: '', videoUrl: '' };
  return enLeccion(secciones, sectionId, lessonId, (l) => ({
    ...l,
    minis: [...(l.minis ?? []), mini],
  }));
}

/**
 * Quita una mini clase. Si era la última, el campo desaparece entero en vez de
 * quedarse como lista vacía: así una lección sin mini clases vuelve a ser
 * exactamente lo que era antes de que existieran.
 */
export function sinMini(
  secciones: CourseSection[],
  sectionId: string,
  lessonId: string,
  miniId: string
): CourseSection[] {
  return enLeccion(secciones, sectionId, lessonId, (l) => {
    const quedan = (l.minis ?? []).filter((m) => m.id !== miniId);
    if (quedan.length > 0) return { ...l, minis: quedan };
    const { minis, ...resto } = l;
    return resto;
  });
}

/*
 * EL PESO DEL CURSO
 *
 * Un curso entero vive en UN documento de Firestore, y ahí el techo es 1 MB.
 * Las miniaturas van dentro (no hay Storage montado), así que un curso con
 * muchas lecciones y una foto en cada una puede llegar al límite. Firestore
 * responde a eso con un error que no dice nada útil y el entrenador perdería
 * el trabajo de la sesión sin saber por qué.
 *
 * Así que se mide antes de guardar y se avisa con lo único que él puede hacer
 * al respecto: quitar alguna miniatura.
 */

/** Techo real de un documento de Firestore. */
export const TOPE_DOCUMENTO = 1_048_576;

/**
 * Margen de seguridad. Lo que se mide aquí es el JSON; Firestore guarda algo
 * más (nombres de campo, índices), así que apurar el último byte sería
 * garantizar el fallo justo el día que no toca.
 */
export const TOPE_SEGURO = Math.round(TOPE_DOCUMENTO * 0.85);

export function pesoDelCurso(curso: Pick<Course, 'sections'> & Partial<Course>): number {
  // El tamaño en bytes, no en caracteres: las miniaturas son base64 (ASCII),
  // pero los títulos llevan tildes y ocupan dos.
  return new TextEncoder().encode(JSON.stringify(curso)).length;
}

export function cuantasMiniaturas(secciones: CourseSection[]): number {
  return secciones.reduce(
    (n, s) =>
      n +
      (s.coverURL ? 1 : 0) +
      s.lessons.reduce(
        (m, l) => m + (l.thumbURL ? 1 : 0) + (l.minis ?? []).filter((x) => x.thumbURL).length,
        0
      ),
    0
  );
}

/** ¿Cabe el curso? Y si no, qué decirle al entrenador. */
export function cabeElCurso(curso: Pick<Course, 'sections'> & Partial<Course>): {
  cabe: boolean;
  peso: number;
  aviso?: string;
} {
  const peso = pesoDelCurso(curso);
  if (peso <= TOPE_SEGURO) return { cabe: true, peso };
  const fotos = cuantasMiniaturas(curso.sections);
  return {
    cabe: false,
    peso,
    aviso:
      `El curso pesa demasiado para guardarse (${Math.round(peso / 1024)} KB de ` +
      `${Math.round(TOPE_SEGURO / 1024)} como mucho). Lleva ${fotos} ` +
      `${fotos === 1 ? 'imagen' : 'imágenes'}: quita alguna miniatura y vuelve a guardar.`,
  };
}
