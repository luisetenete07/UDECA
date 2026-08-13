import type { ContenidoDeCurso, Course, Lesson } from './types';

/**
 * Cuánto lleva visto cada alumno de cada curso.
 *
 * Es la última pregunta del panel que no se podía contestar: un entrenador
 * publica un curso y no tiene forma de saber si alguien lo ha abierto. Sin eso,
 * grabar la siguiente lección es una apuesta.
 *
 * Se marca a mano, con un toque, y NO se deduce de abrir la lección. Podría
 * hacerse —abrir el vídeo y darlo por visto— y sería un dato precioso y falso:
 * la mitad de la gente abre para ver de qué va y cierra. Un dato en el que el
 * entrenador no pueda fiarse es peor que no tener dato, porque igualmente
 * decide sobre él.
 */

/** Lecciones vistas por curso: `{ [courseId]: [lessonId, ...] }`. */
export type LessonsSeen = Record<string, string[]>;

const DIA_MS = 24 * 60 * 60 * 1000;

/** ¿Esto tiene algo que ver? Lo que está "Pronto" no cuenta. */
export function tieneContenido(l: ContenidoDeCurso): boolean {
  const esPdf = l.kind === 'pdf' || (!l.videoUrl && !!l.pdfUrl);
  return esPdf ? !!l.pdfUrl : !!l.videoUrl;
}

/**
 * Todo lo que se puede ver de una lección: ella misma si tiene vídeo, y sus
 * mini clases.
 *
 * Una lección puede ser solo un contenedor —sin vídeo propio, con tres mini
 * clases dentro—, y entonces lo que cuenta son las tres. Si contara la lección
 * vacía, el curso tendría un elemento que nadie puede ver nunca y se quedaría
 * en un 90 % eterno que parece culpa del alumno.
 */
export function contenidosDeLeccion(l: Lesson): ContenidoDeCurso[] {
  return [
    ...(tieneContenido(l) ? [l] : []),
    ...(l.minis ?? []).filter(tieneContenido),
  ];
}

/**
 * Las lecciones que cuentan para el total.
 *
 * Solo las que tienen contenido: una lección anunciada y sin subir no la puede
 * ver nadie, y contarla dejaría el curso en un 90 % eterno que parece culpa del
 * alumno. Las bloqueadas por antigüedad SÍ cuentan: son parte del curso y
 * llegarán solas.
 */
export function leccionesContables(course: Course): ContenidoDeCurso[] {
  return course.sections.flatMap((s) => s.lessons.flatMap(contenidosDeLeccion));
}

/** ¿Está bloqueada por antigüedad para alguien con estos días de alta? */
export function bloqueada(l: Lesson, diasDeAlta: number): boolean {
  return !!l.unlockAfterDays && diasDeAlta < l.unlockAfterDays;
}

/**
 * El candado de una lección alcanza a sus mini clases.
 *
 * Es lo único que puede significar: si la lección no se ve todavía, sus mini
 * clases tampoco, o el candado no serviría para nada. Por eso las mini clases
 * no tienen candado propio —sería una segunda forma de decir lo mismo, y de
 * contradecirse.
 */
export function contenidosDesbloqueados(l: Lesson, diasDeAlta: number): ContenidoDeCurso[] {
  return bloqueada(l, diasDeAlta) ? [] : contenidosDeLeccion(l);
}

export interface EstadoCurso {
  courseId: string;
  titulo: string;
  total: number;
  hechas: number;
  /** 0..1. Sin lecciones contables es 0, no 1: no se ha hecho nada. */
  ratio: number;
  terminado: boolean;
  empezado: boolean;
  /** Lo siguiente que puede ver hoy, si queda algo desbloqueado. */
  siguiente: ContenidoDeCurso | null;
}

export function estadoDeCurso(
  course: Course,
  vistas: string[] | undefined,
  diasDeAlta = Number.MAX_SAFE_INTEGER
): EstadoCurso {
  const contables = leccionesContables(course);
  const set = new Set(vistas ?? []);
  // Solo cuentan las vistas que siguen existiendo: si el entrenador borra una
  // lección, la marca vieja no puede seguir sumando o el curso saldría al
  // 120 % —o terminado sin estarlo.
  const hechas = contables.filter((l) => set.has(l.id)).length;
  const total = contables.length;
  // Lo siguiente que puede ver HOY: se recorren las lecciones en orden y de
  // cada una lo que su candado deja pasar.
  const siguiente =
    course.sections
      .flatMap((s) => s.lessons.flatMap((l) => contenidosDesbloqueados(l, diasDeAlta)))
      .find((c) => !set.has(c.id)) ?? null;

  return {
    courseId: course.id,
    titulo: course.title,
    total,
    hechas,
    ratio: total > 0 ? hechas / total : 0,
    terminado: total > 0 && hechas >= total,
    empezado: hechas > 0,
    siguiente,
  };
}

/** Días desde el alta, para los candados por antigüedad. */
export function diasDeAlta(createdAt: number | undefined, ahora = Date.now()): number {
  if (!createdAt) return 0;
  return Math.floor((ahora - createdAt) / DIA_MS);
}
