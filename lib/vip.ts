import type { ContenidoDeCurso, Course, Lesson, UserProfile } from './types';
import { tieneContenido } from './courseProgress';

/**
 * Clases VIP: contenido que solo ven los alumnos que el entrenador marca.
 *
 * Un entrenador no cobra lo mismo a todos. Hay quien paga 45 € por el plan y
 * quien paga 120 € por el plan más la formación entera, y hasta ahora la única
 * forma de darles cosas distintas era montar dos cursos y acordarse de a quién
 * se le enseña cada uno. Con una casilla por clase y otra en la ficha del
 * alumno, el mismo curso sirve para los dos.
 *
 * DÓNDE SE DECIDE CADA COSA, que es lo que hace que esto no se enrede:
 *  - Que una clase sea VIP se marca en la clase, dentro del curso.
 *  - Que un alumno sea VIP se marca en SU ficha, y vale para todos los cursos
 *    de ese entrenador. Un alumno no es "VIP de este curso": es VIP o no lo es.
 *
 * LO QUE VE EL QUE NO ES VIP: el curso ENTERO, con lo VIP cerrado con
 * candado. Antes lo VIP ni aparecía; Luis lo quiere a la vista, para que el
 * alumno sepa todo lo que tiene el curso aunque no pueda abrirlo. Sin precio ni
 * botón de comprar: la app no vende nada, y pasar a VIP es cosa de hablarlo con
 * Luis.
 *
 * LO QUE CUENTA: solo lo que puede abrir. El avance se calcula con el curso ya
 * podado (`cursoParaMi`), y es a propósito: si las clases cerradas sumaran al
 * total, el porcentaje se quedaría clavado en el 60 % para siempre, sin que
 * nadie entienda por qué. Así que hay dos vistas del mismo curso: la entera,
 * para PINTAR (`claseCerrada` dice qué va con candado), y la podada, para
 * CONTAR —el total, el siguiente, el "terminado"—.
 */

/** ¿Este alumno tiene acceso a lo VIP? */
export function esVip(profile: UserProfile | null | undefined): boolean {
  return profile?.vip === true;
}

/** ¿Puede ver esto? Lo que no está marcado como VIP lo ve todo el mundo. */
export function visibleParaMi(c: Pick<ContenidoDeCurso, 'vip'>, vip: boolean): boolean {
  return vip || c.vip !== true;
}

/**
 * La lección tal y como la ve ese alumno, o `null` si no le toca nada.
 *
 * El VIP de la lección alcanza a sus mini clases: si la lección no es para ti,
 * lo de dentro tampoco. Al revés no: una lección abierta puede tener dentro
 * una mini clase VIP, y entonces solo se cae esa.
 */
export function leccionParaMi(l: Lesson, vip: boolean): Lesson | null {
  if (!visibleParaMi(l, vip)) return null;
  const minis = (l.minis ?? []).filter((m) => visibleParaMi(m, vip));
  const podada: Lesson = { ...l, minis };
  // Una lección que era solo un contenedor de minis VIP se queda sin nada que
  // enseñar. Dejarla sería una fila que no lleva a ninguna parte.
  if (!tieneContenido(podada) && minis.length === 0 && (l.minis ?? []).length > 0) return null;
  return podada;
}

/** El curso entero, ya podado. Se llama ANTES de contar o de pintar nada. */
export function cursoParaMi(course: Course, vip: boolean): Course {
  if (vip) return course;
  const sections = course.sections
    .map((s) => ({
      ...s,
      lessons: s.lessons
        .map((l) => leccionParaMi(l, vip))
        .filter((l): l is Lesson => l !== null),
    }))
    // Una sección entera VIP desaparece: un título con nada debajo es peor que
    // no estar.
    .filter((s) => s.lessons.length > 0);
  return { ...course, sections };
}

/**
 * ¿Va con candado esta clase para este alumno?
 *
 * Una mini clase se cierra si es VIP ella o si lo es la lección que la
 * contiene: lo que hay dentro de algo cerrado también está cerrado.
 */
export function claseCerrada(
  clase: Pick<ContenidoDeCurso, 'vip'>,
  vip: boolean,
  leccion?: Pick<Lesson, 'vip'>
): boolean {
  if (vip) return false;
  return !visibleParaMi(clase, vip) || (!!leccion && !visibleParaMi(leccion, vip));
}

/** ¿Está entero cerrado? Un curso o una sección sin nada que pueda abrir. */
export function todoCerrado(course: Course, vip: boolean): boolean {
  if (vip) return false;
  const tiene = course.sections.some((s) => s.lessons.length > 0);
  return tiene && cursoParaMi(course, vip).sections.length === 0;
}

/** Cuántas clases le quedan con candado en este curso (lecciones y minis). */
export function cuantasCerradas(course: Course, vip: boolean): number {
  return vip ? 0 : cuantasVipVisibles(course);
}

/**
 * Las clases con candado tal y como las ve quien no es VIP: cada vídeo o
 * e-book que no puede abrir. Las minis de una lección VIP se cierran con ella,
 * y una lección que solo agrupa minis no cuenta como clase.
 */
function cuantasVipVisibles(course: Course): number {
  let n = 0;
  for (const s of course.sections) {
    for (const l of s.lessons) {
      if (l.vip === true && tieneContenido(l)) n++;
      for (const m of l.minis ?? []) {
        if ((l.vip === true || m.vip === true) && tieneContenido(m)) n++;
      }
    }
  }
  return n;
}

/** ¿Hay algo VIP aquí dentro? Lo usa el coach para saber qué está limitando. */
export function tieneAlgoVip(course: Course): boolean {
  return course.sections.some((s) =>
    s.lessons.some((l) => l.vip === true || (l.minis ?? []).some((m) => m.vip === true))
  );
}

/** Cuántas clases VIP tiene el curso (contando mini clases). */
export function cuantasVip(course: Course): number {
  return course.sections.reduce(
    (n, s) =>
      n +
      s.lessons.reduce(
        (m, l) => m + (l.vip === true ? 1 : 0) + (l.minis ?? []).filter((x) => x.vip === true).length,
        0
      ),
    0
  );
}
