import { esMismoDia } from './fechas';
import { frase } from './idioma';
import type { LoggedExercise, Routine, RoutineDay, WorkoutLog } from './types';

/**
 * Grease the groove: muchas series fáciles repartidas por el día.
 *
 * Es un método distinto de todo lo demás que hay en la app, y por eso necesita
 * su propio modo en vez de una rutina normal con muchas series. La diferencia
 * no está en el número: está en CÓMO se hace.
 *
 *  - Una sesión normal se abre una vez, se hace entera y se cierra. Aquí se
 *    abre ocho veces al día para hacer UNA serie y cerrarse.
 *  - Una sesión normal busca el fallo o acercarse. Aquí no se llega nunca: la
 *    serie tiene que quedarse a la mitad de lo que se podría hacer, porque lo
 *    que se entrena es el gesto, no el músculo. Alguien que va al fallo en
 *    grease the groove no está haciendo grease the groove: está haciendo mucho
 *    volumen mal repartido y se va a estancar.
 *  - Una sesión normal se falla o se hace. Aquí quedarse en 5 de 8 series es un
 *    día bueno, no un día fallado.
 *
 * TODO EL DÍA VA A UN SOLO ENTRENO
 *
 * Las series se van añadiendo al MISMO registro del día, no a ocho registros
 * distintos. Si cada serie fuera un entreno, la racha contaría ocho, el
 * histórico tendría ocho filas por día y el volumen semanal no habría quien lo
 * leyera. Un día de grease the groove es un entreno, como cualquier otro.
 */

/** Series al día por omisión, si el entrenador no dice otra cosa. */
export const SERIES_POR_DEFECTO = 6;

/**
 * ¿Toca grease the groove?
 *
 * Hay dos formas de llegar aquí, y las dos son legítimas:
 *  - la rutina ENTERA está en este modo (`schedule === 'gtg'`);
 *  - o es una de las rutinas de Sensaciones, marcada día a día. Ahí conviven
 *    varias formas de entrenar y el alumno elige una cada mañana: el día que
 *    no tiene cuerpo para una sesión puede hacer seis series fáciles
 *    repartidas en vez de no hacer nada.
 *
 * Con día, manda el día: en Sensaciones la rutina no está en modo gtg y aun
 * así el día elegido puede serlo.
 */
export function esGtg(
  routine: Routine | null | undefined,
  dia?: RoutineDay | null
): boolean {
  if (dia) return dia.gtg === true;
  return routine?.schedule === 'gtg';
}

/** Cuántas series se buscan hoy. Las del día mandan sobre las de la rutina. */
export function objetivoDelDia(
  routine: Routine | null | undefined,
  dia?: RoutineDay | null
): number {
  if (dia?.gtg) {
    return Math.max(1, dia.gtgSetsPerDay ?? routine?.gtgSetsPerDay ?? SERIES_POR_DEFECTO);
  }
  if (!esGtg(routine)) return 0;
  return Math.max(1, routine?.gtgSetsPerDay ?? SERIES_POR_DEFECTO);
}

/**
 * El registro de HOY de esta rutina, si ya se empezó.
 *
 * Con `nombreDelDia` se exige además que sea el de ESE día. Hace falta en
 * Sensaciones: si por la mañana se hizo una sesión normal y por la tarde se
 * elige el día de grease the groove, las series sueltas no pueden colarse
 * dentro del entreno de la mañana.
 */
export function entrenoDeHoy(
  logs: WorkoutLog[],
  routineId: string,
  ahora = Date.now(),
  nombreDelDia?: string
): WorkoutLog | null {
  return (
    logs.find(
      (l) =>
        l.routineId === routineId &&
        esMismoDia(l.date, ahora) &&
        (nombreDelDia === undefined || l.dayName === nombreDelDia)
    ) ?? null
  );
}

/** Series ya hechas hoy, sumando las de todos los ejercicios. */
export function seriesDeHoy(log: WorkoutLog | null): number {
  if (!log) return 0;
  return log.exercises.reduce((n, e) => n + e.sets.filter((s) => s.completed).length, 0);
}

export interface ProgresoGtg {
  hechas: number;
  objetivo: number;
  /** 0..1, sin pasarse de 1 aunque se hagan de más. */
  ratio: number;
  /** Se ha llegado al objetivo del día. */
  completo: boolean;
  /** Lo que falta, nunca negativo. */
  quedan: number;
}

export function progresoGtg(
  routine: Routine | null | undefined,
  log: WorkoutLog | null,
  dia?: RoutineDay | null
): ProgresoGtg {
  const objetivo = objetivoDelDia(routine, dia);
  const hechas = seriesDeHoy(log);
  return {
    hechas,
    objetivo,
    ratio: objetivo > 0 ? Math.min(1, hechas / objetivo) : 0,
    completo: objetivo > 0 && hechas >= objetivo,
    quedan: Math.max(0, objetivo - hechas),
  };
}

/**
 * Añade una serie al entreno del día.
 *
 * Si el ejercicio ya estaba, la serie se le suma; si no, entra con la suya.
 * Devuelve la lista de ejercicios entera, lista para guardar.
 */
export function conSerieAnadida(
  ejercicios: LoggedExercise[],
  ejercicio: { exerciseId: string; name: string; measure?: LoggedExercise['measure'] },
  marca: string,
  peso?: string
): LoggedExercise[] {
  const serie = { reps: marca, weight: peso ?? '', completed: true };
  const i = ejercicios.findIndex((e) => e.exerciseId === ejercicio.exerciseId);
  if (i === -1) {
    return [
      ...ejercicios,
      {
        exerciseId: ejercicio.exerciseId,
        name: ejercicio.name,
        measure: ejercicio.measure,
        sets: [serie],
      },
    ];
  }
  return ejercicios.map((e, j) => (j === i ? { ...e, sets: [...e.sets, serie] } : e));
}

/**
 * Quita la última serie añadida, para deshacer un toque de más.
 *
 * Se quita la del final de la lista, que es la que se acaba de meter. Si un
 * ejercicio se queda sin series, desaparece: dejarlo con cero series haría que
 * el histórico enseñara un ejercicio que no se llegó a hacer.
 */
export function sinLaUltimaSerie(ejercicios: LoggedExercise[]): LoggedExercise[] {
  for (let i = ejercicios.length - 1; i >= 0; i--) {
    if (ejercicios[i].sets.length > 0) {
      const sets = ejercicios[i].sets.slice(0, -1);
      const resto = ejercicios.filter((_, j) => j !== i);
      if (sets.length === 0) return resto;
      return ejercicios.map((e, j) => (j === i ? { ...e, sets } : e));
    }
  }
  return ejercicios;
}

/**
 * Qué decirle según cómo lleve el día.
 *
 * El texto no felicita por hacer más de la cuenta: en grease the groove pasarse
 * es el error más común y el que estanca. Con el objetivo hecho, lo que toca es
 * parar.
 */
export function textoDelDia(p: ProgresoGtg): string {
  if (p.objetivo === 0) return '';
  if (p.hechas === 0) return frase`Hoy: ${p.objetivo} series repartidas. Ninguna al fallo.`;
  if (p.completo) return 'Objetivo del día hecho. Descansa y mañana otra vez.';
  if (p.quedan === 1) return 'Queda una. Que salga tan fácil como la primera.';
  return frase`Llevas ${p.hechas}. Quedan ${p.quedan}, sin prisa y sin apretar.`;
}
