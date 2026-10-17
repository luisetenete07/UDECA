import type { PlanPersonalizado } from './planPersonalizado';
import type { RoutineDay, RoutineExercise } from './types';

/**
 * VARIAS RUTINAS EN UN MISMO ENTRENO.
 *
 * En el personalizado el alumno puede marcar más de una rutina antes de
 * empezar ("Empuje fuerte" y "Tirón medio") y se hacen en el mismo entreno.
 * Cómo se juntan lo decide el ENTRENADOR en su plan, no el alumno:
 *
 *  - 'seguidas' (lo de siempre): primero una rutina entera y después la otra.
 *  - 'superseries': se fusionan. El primer bloque de una con el primero de la
 *    otra, en superserie; después los segundos, y así. Una serie de empuje,
 *    sin descanso una de tirón, y entonces sí, descanso.
 *
 * El orden lo pone el alumno al marcarlas: si marca Tirón antes que Empuje, la
 * ronda empieza por el tirón. Es el "o viceversa".
 *
 * POR BLOQUES, NO POR EJERCICIOS
 *
 * Si una rutina ya trae una superserie suya (A1 + A2), fusionar ejercicio a
 * ejercicio la partiría y A2 acabaría emparejado con un ejercicio de la otra
 * rutina. Se fusiona por bloques: lo que el entrenador encadenó sigue
 * encadenado, y se le suma lo de la otra rutina (A1 + A2 + B1).
 *
 * LA QUE TIENE MÁS
 *
 * Si una rutina tiene cuatro bloques y la otra tres, el cuarto va solo. Es el
 * mismo caso que una superserie de series desiguales (lib/superserie.ts): no
 * se inventa una pareja que el entrenador no ha puesto.
 */
export type ComoSeCombinan = 'seguidas' | 'superseries';

/** Lo que haya decidido el entrenador; sin decir nada, una detrás de otra. */
export function comoSeCombinan(plan?: Pick<PlanPersonalizado, 'combinar'>): ComoSeCombinan {
  return plan?.combinar === 'superseries' ? 'superseries' : 'seguidas';
}

/** Los bloques de una rutina: cada ejercicio con los que lleva encadenados detrás. */
export function bloquesDe<E extends Pick<RoutineExercise, 'supersetWithPrevious'>>(ejercicios: E[]): E[][] {
  const bloques: E[][] = [];
  ejercicios.forEach((e, i) => {
    if (i > 0 && e.supersetWithPrevious && bloques.length > 0) bloques[bloques.length - 1].push(e);
    else bloques.push([e]);
  });
  return bloques;
}

/**
 * Los ejercicios del entreno combinado, ya en su orden y con sus superseries.
 *
 * En 'superseries', el último de cada ronda lleva el descanso MÁS LARGO de la
 * ronda: es tras el que se descansa (ver `descansoDelBloque`), y si el empuje
 * pedía 2 min y el tirón 1,5, la pareja entera pide los 2.
 */
export function combinarRutinas(dias: Pick<RoutineDay, 'exercises'>[], modo: ComoSeCombinan): RoutineExercise[] {
  if (modo === 'seguidas' || dias.length < 2) {
    // Cada rutina empieza suelta: su primer ejercicio no puede encadenarse con
    // el último de la rutina de antes, aunque lo diga una marca vieja.
    return dias.flatMap((d) => d.exercises.map((e, i) => (i === 0 ? { ...e, supersetWithPrevious: false } : e)));
  }
  const porRutina = dias.map((d) => bloquesDe(d.exercises));
  const rondas = Math.max(0, ...porRutina.map((b) => b.length));
  const salida: RoutineExercise[] = [];
  for (let r = 0; r < rondas; r++) {
    const ronda = porRutina.flatMap((bloques) => bloques[r] ?? []);
    if (ronda.length === 0) continue;
    const descanso = Math.max(0, ...ronda.map((e) => e.restSeconds ?? 0));
    ronda.forEach((e, i) => {
      const ultimo = i === ronda.length - 1;
      salida.push({
        ...e,
        supersetWithPrevious: i > 0,
        ...(ultimo && descanso > 0 ? { restSeconds: descanso } : {}),
      });
    });
  }
  return salida;
}

/**
 * Cómo va a quedar, para enseñárselo al alumno ANTES de empezar: una línea por
 * ronda con sus ejercicios. Así sabe a qué se mete y en qué orden.
 */
export function rondasDeLaCombinacion(ejercicios: Pick<RoutineExercise, 'name' | 'supersetWithPrevious'>[]): string[][] {
  return bloquesDe(ejercicios).map((b) => b.map((e) => e.name));
}
