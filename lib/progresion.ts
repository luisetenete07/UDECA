import { frase } from './idioma';
import { cuentaComoMarca, isDualMeasure, isHoldMeasure, resolveLoad, type RoutineExercise, type WorkoutLog } from './types';

/*
 * SUGERENCIA DE PROGRESIÓN.
 *
 * Cuando un alumno cumple un ejercicio de sobra dos sesiones seguidas —todas
 * las series, llegando arriba del objetivo y sin ir al fallo—, el plan se le
 * ha quedado corto. El entrenador lo veía solo si abría el historial ejercicio
 * por ejercicio; ahora el editor de la rutina se lo dice en la propia ficha y,
 * cuando se puede, lo deja aplicado con un toque.
 *
 * Es una sugerencia y nada más: no cambia nada sola. El entrenador sabe cosas
 * que los números no (una lesión, un viaje, que ese día le ayudaron).
 */

/** Sesiones seguidas cumpliéndolo de sobra para sugerir subir. */
export const SESIONES_PARA_SUBIR = 2;

/** El tope del objetivo: "8" → 8, "8-10" → 10, "10+" → 10. null si no se entiende. */
export function topeDelObjetivo(reps: string | undefined): number | null {
  const numeros = (reps ?? '').match(/\d+/g);
  if (!numeros || numeros.length === 0) return null;
  const n = Math.max(...numeros.map(Number));
  return n > 0 ? n : null;
}

/** El objetivo, subido: "8" → "9", "8-10" → "9-11". null si no es un número o un rango. */
export function objetivoSubido(reps: string, paso: number): string | null {
  const t = reps.trim();
  if (/^\d+$/.test(t)) return String(Number(t) + paso);
  const rango = t.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rango) return `${Number(rango[1]) + paso}-${Number(rango[2]) + paso}`;
  return null;
}

export interface Sugerencia {
  /** Lo que se le dice al entrenador. */
  texto: string;
  /** El nuevo objetivo, si se puede aplicar de un toque. */
  reps?: string;
}

/**
 * La sugerencia para un ejercicio de la rutina, o null si no toca.
 *
 * `logs` es el historial del alumno (en cualquier orden).
 */
export function sugerenciaDeProgresion(
  logs: WorkoutLog[],
  ex: Pick<RoutineExercise, 'exerciseId' | 'reps' | 'sets' | 'measure' | 'load' | 'band'>
): Sugerencia | null {
  // Combo y por lados tienen dos marcas por serie: subir una sola no tiene
  // sentido, y subir las dos es una decisión que no toca adivinar.
  if (ex.measure === 'combo' || isDualMeasure(ex.measure)) return null;
  const tope = topeDelObjetivo(ex.reps);
  if (!tope || !ex.sets) return null;

  const recientes = logs
    .filter((l) => l.exercises?.some((e) => e.exerciseId === ex.exerciseId && !e.saltado))
    .sort((a, b) => b.date - a.date)
    .slice(0, SESIONES_PARA_SUBIR);
  if (recientes.length < SESIONES_PARA_SUBIR) return null;

  const deSobra = recientes.every((l) => {
    const e = l.exercises.find((x) => x.exerciseId === ex.exerciseId)!;
    // En regresión no se llega: se hizo una versión más fácil.
    const llegan = e.sets.filter((s) => cuentaComoMarca(s) && parseInt(s.reps, 10) >= tope).length;
    if (llegan < ex.sets) return false;
    // Si dijo que fue al fallo (RIR 0), lo cumplió justo: no es "de sobra".
    if (typeof e.rir === 'number' && e.rir < 1) return false;
    return true;
  });
  if (!deSobra) return null;

  const carga = resolveLoad(ex);
  if (carga === 'weighted') return { texto: 'Lo cumple de sobra: súbele la carga' };
  if (carga === 'assisted') return { texto: 'Lo cumple de sobra: prueba con menos goma' };
  const segundos = isHoldMeasure(ex.measure);
  const nuevo = objetivoSubido(ex.reps, segundos ? 5 : 1);
  if (!nuevo) return null;
  return {
    texto: segundos
      ? frase`Lo cumple de sobra: súbelo a ${nuevo} s`
      : frase`Lo cumple de sobra: súbelo a ${nuevo} reps`,
    reps: nuevo,
  };
}
