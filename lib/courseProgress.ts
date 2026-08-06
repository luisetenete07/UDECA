import type { Course, Lesson } from './types';

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

/** ¿Esta lección tiene algo que ver? Las que están "Pronto" no cuentan. */
export function tieneContenido(l: Lesson): boolean {
  const esPdf = l.kind === 'pdf' || (!l.videoUrl && !!l.pdfUrl);
  return esPdf ? !!l.pdfUrl : !!l.videoUrl;
}

/**
 * Las lecciones que cuentan para el total.
 *
 * Solo las que tienen contenido: una lección anunciada y sin subir no la puede
 * ver nadie, y contarla dejaría el curso en un 90 % eterno que parece culpa del
 * alumno. Las bloqueadas por antigüedad SÍ cuentan: son parte del curso y
 * llegarán solas.
 */
export function leccionesContables(course: Course): Lesson[] {
  return course.sections.flatMap((s) => s.lessons.filter(tieneContenido));
}

/** ¿Está bloqueada por antigüedad para alguien con estos días de alta? */
export function bloqueada(l: Lesson, diasDeAlta: number): boolean {
  return !!l.unlockAfterDays && diasDeAlta < l.unlockAfterDays;
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
  siguiente: Lesson | null;
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
  const siguiente =
    contables.find((l) => !set.has(l.id) && !bloqueada(l, diasDeAlta)) ?? null;

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

export interface ResumenAlumnoCursos {
  uid: string;
  name: string;
  photoURL?: string | null;
  total: number;
  hechas: number;
  ratio: number;
  /** Cursos terminados del todo. */
  terminados: number;
  /** No ha abierto ninguno. */
  sinEmpezar: boolean;
}

/**
 * Lo que ve el entrenador de cada alumno: su avance sumando TODOS los cursos
 * publicados, no curso a curso. En el panel importa quién se ha quedado atrás,
 * no en qué lección exacta.
 */
export function resumenPorAlumno(
  courses: Course[],
  alumnos: { uid: string; name: string; photoURL?: string | null; createdAt?: number }[],
  vistasPorAlumno: Record<string, LessonsSeen>,
  ahora = Date.now()
): ResumenAlumnoCursos[] {
  return alumnos
    .map((a) => {
      const dias = diasDeAlta(a.createdAt, ahora);
      const suyas = vistasPorAlumno[a.uid] ?? {};
      let total = 0;
      let hechas = 0;
      let terminados = 0;
      for (const c of courses) {
        const e = estadoDeCurso(c, suyas[c.id], dias);
        total += e.total;
        hechas += e.hechas;
        if (e.terminado) terminados += 1;
      }
      return {
        uid: a.uid,
        name: a.name,
        photoURL: a.photoURL,
        total,
        hechas,
        ratio: total > 0 ? hechas / total : 0,
        terminados,
        sinEmpezar: hechas === 0,
      };
    })
    // Primero quien menos lleva: es a quien hay que empujar.
    .sort((a, b) => a.ratio - b.ratio || a.name.localeCompare(b.name, 'es'));
}

export interface ResumenGrupoCursos {
  /** Lecciones con contenido en todos los cursos publicados. */
  leccionesPublicadas: number;
  alumnos: number;
  sinEmpezar: number;
  terminado: number;
  /** Media del avance del grupo, 0..1. */
  media: number;
  /** Los que menos llevan, para poder escribirles. */
  rezagados: ResumenAlumnoCursos[];
}

export function resumenDeGrupo(
  courses: Course[],
  porAlumno: ResumenAlumnoCursos[]
): ResumenGrupoCursos {
  const leccionesPublicadas = courses.reduce((n, c) => n + leccionesContables(c).length, 0);
  const alumnos = porAlumno.length;
  const sinEmpezar = porAlumno.filter((a) => a.sinEmpezar).length;
  const terminado = porAlumno.filter((a) => a.total > 0 && a.hechas >= a.total).length;
  const media =
    alumnos > 0 ? porAlumno.reduce((s, a) => s + a.ratio, 0) / alumnos : 0;

  return {
    leccionesPublicadas,
    alumnos,
    sinEmpezar,
    terminado,
    media,
    // Quien no ha empezado ya sale contado arriba; aquí interesa quien empezó
    // y se quedó a medias, que es a quien un mensaje puede rescatar.
    rezagados: porAlumno.filter((a) => !a.sinEmpezar && a.ratio < 1).slice(0, 3),
  };
}
