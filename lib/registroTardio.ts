import { esMismoDia, inicioDelDia, masDias, mediodiaDe } from './fechas';
import type { LoggedExercise, RoutineDay, WorkoutLog } from './types';
import { resolveLoad } from './types';

/**
 * Registrar un entreno que ya se hizo, días después.
 *
 * La app da por hecho que se entrena con el móvil delante, marcando serie a
 * serie. Y muchas veces no es así: el móvil se queda en la mochila, se acaba
 * la batería, se entrena con alguien y no se saca, o sencillamente se olvida.
 * Hasta ahora ese entreno se perdía —no contaba para la racha, no salía en el
 * histórico y el entrenador no lo veía—, y perder entrenos hechos es la forma
 * más rápida de que alguien deje de fiarse de lo que le cuenta la app.
 *
 * Lo que se registra así no es un entreno de segunda: cuenta igual. Lo único
 * que cambia es que la hora no se sabe y la duración se escribe a mano.
 */

/** Cuántos días atrás se puede registrar. Más allá, ya no se acuerda nadie. */
export const DIAS_ATRAS = 14;

/**
 * Los días entre los que elegir, de hoy hacia atrás.
 *
 * No hay días futuros a propósito: un entreno de mañana no se ha hecho, y
 * dejarlo registrar sería la forma más fácil de inflar la racha sin entrenar.
 */
export function diasParaElegir(ahora = Date.now(), cuantos = DIAS_ATRAS): number[] {
  return Array.from({ length: Math.max(1, cuantos) }, (_, i) => masDias(ahora, -i));
}

/**
 * La hora con la que se guarda.
 *
 * Si es de hoy, la de ahora, que es la de verdad. Si es de otro día, el
 * mediodía: no se sabe a qué hora fue y el mediodía es la hora que no se cae
 * al día de al lado por un desfase de nada.
 */
export function fechaDelRegistro(dia: number, ahora = Date.now()): number {
  return esMismoDia(dia, ahora) ? ahora : mediodiaDe(dia);
}

/** ¿Se puede registrar ese día? Ni el futuro ni más allá del límite. */
export function diaValido(dia: number, ahora = Date.now(), cuantos = DIAS_ATRAS): boolean {
  const hoy = inicioDelDia(ahora);
  return inicioDelDia(dia) <= hoy && inicioDelDia(dia) >= masDias(ahora, -(cuantos - 1));
}

/**
 * El entreno de partida a partir del día del plan.
 *
 * Las series salen ya marcadas como hechas: se está registrando algo que YA se
 * hizo, así que empezar con todas sin marcar obligaría a tocarlas una por una
 * para volver al punto de partida.
 */
export function logDelDia(dia: RoutineDay | null | undefined): LoggedExercise[] {
  if (!dia) return [];
  return dia.exercises.map((ex) => {
    // Si el plan fija un número exacto, se precarga; si es un rango ("8-12") o
    // texto ("AMRAP"), se deja vacío: ahí el dato que vale es el que hizo.
    const objetivo = (ex.reps ?? '').trim();
    const previo = /^\d+$/.test(objetivo) ? objetivo : '';
    return {
      exerciseId: ex.exerciseId,
      name: ex.name,
      measure: ex.measure ?? 'reps',
      load: resolveLoad(ex),
      sets: Array.from({ length: ex.sets || 1 }, () => ({
        reps: previo,
        weight: '',
        completed: true,
      })),
    };
  });
}

/** Una serie más en ese ejercicio, vacía. */
export function conUnaSerieMas(log: LoggedExercise[], i: number): LoggedExercise[] {
  return log.map((ex, j) =>
    j === i ? { ...ex, sets: [...ex.sets, { reps: '', weight: '', completed: true }] } : ex
  );
}

/** Una serie menos. El ejercicio que se queda sin ninguna, fuera. */
export function conUnaSerieMenos(log: LoggedExercise[], i: number): LoggedExercise[] {
  const ex = log[i];
  if (!ex) return log;
  if (ex.sets.length <= 1) return log.filter((_, j) => j !== i);
  return log.map((e, j) => (j === i ? { ...e, sets: e.sets.slice(0, -1) } : e));
}

/**
 * ¿Hay algo que guardar?
 *
 * Basta con una serie. No se exige que estén todas las marcas escritas: quien
 * registra un entreno de hace tres días se acuerda de que hizo cuatro series
 * de dominadas mucho mejor que de cuántas repeticiones hizo en la tercera, y
 * un entreno con las series puestas y las marcas a medias es infinitamente más
 * útil que ningún entreno.
 */
export function hayAlgoQueGuardar(log: LoggedExercise[]): boolean {
  return log.some((ex) => ex.sets.length > 0);
}

/** Los minutos escritos a mano, ya en número. Vacío o disparatado, nada. */
export function minutosDeTexto(texto: string): number | undefined {
  const n = Number.parseInt(texto, 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  // Una sesión de más de doce horas es un dedo, no un entreno.
  return Math.min(n, 12 * 60);
}

/**
 * Entrenos ya registrados ese día, para avisar antes de duplicar.
 *
 * No lo impide: hay quien entrena dos veces en un día, y decidir por él que no
 * puede sería peor que el aviso.
 */
export function entrenosDelDia(logs: WorkoutLog[], dia: number): WorkoutLog[] {
  return logs.filter((l) => esMismoDia(l.date, dia));
}
