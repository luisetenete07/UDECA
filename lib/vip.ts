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
 * CÓMO SE APLICA: filtrando el curso ANTES de hacer nada con él
 * (`cursoParaMi`). Es a propósito, y es lo que evita el fallo silencioso de
 * este tipo de funciones: si el filtro se aplicara solo al pintar la lista, el
 * porcentaje de avance seguiría contando lecciones que ese alumno no puede
 * abrir y se quedaría clavado en el 60 % para siempre, sin que nadie entienda
 * por qué. Filtrando el curso entero, todo lo demás —el total, el siguiente,
 * el "terminado"— sale bien sin tocar una línea.
 *
 * Lo que NO hace: enseñar un candado. Una clase VIP no existe para quien no lo
 * es. Enseñar lo que no puedes tener es un anuncio dentro de algo que ya has
 * pagado, y el que decide vender el plan de arriba es el entrenador hablando
 * con su alumno, no la app poniéndole un cartel.
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

/** Todos los cursos, podados de una vez. */
export function cursosParaMi(courses: Course[], vip: boolean): Course[] {
  if (vip) return courses;
  // Un curso al que no le queda nada no se enseña: sería una portada que al
  // abrirla está vacía.
  return courses.map((c) => cursoParaMi(c, vip)).filter((c) => c.sections.length > 0);
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
