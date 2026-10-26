/**
 * Lo que el editor de rutinas del entrenador hace por él, para ahorrarle
 * tecleo: con qué números entra un ejercicio nuevo, qué día de la semana
 * coge un día nuevo, cómo se resume un día plegado, qué hace "Igualar" con
 * todos los ejercicios de un día y cómo comparte una superserie sus series y
 * su descanso.
 *
 * Sin React a propósito: se prueba en scripts/check-editor-rapido.mjs.
 */
import { bloqueDe, descansoDelBloque } from './superserie';
import { isDualMeasure, isHoldMeasure, type ExerciseMeasure, type RoutineDay, type RoutineExercise } from './types';

/**
 * LOS NÚMEROS DE UN EJERCICIO NUEVO: los del último del día.
 *
 * Un día se monta casi siempre con las mismas series, el mismo descanso y el
 * mismo RIR; teclearlos en cada ejercicio era lo más lento de montar una
 * rutina. Las reps salen del último que se mida IGUAL (unas dominadas no le
 * pasan sus "6" a una plancha de 30 s). En un día vacío, lo de siempre:
 * 3 series de 10 reps, o de 30 s si es un isométrico.
 */
export function numerosHeredados(
  previos: RoutineExercise[],
  medida: ExerciseMeasure
): Pick<RoutineExercise, 'sets' | 'reps' | 'restSeconds' | 'rir' | 'prescrito'> {
  const ultimo = previos[previos.length - 1];
  const igual = [...previos].reverse().find((e) => (e.measure ?? 'reps') === medida);
  const numeros: Pick<RoutineExercise, 'sets' | 'reps' | 'restSeconds' | 'rir' | 'prescrito'> = {
    sets: ultimo?.sets || 3,
    reps: igual?.reps || (isHoldMeasure(medida) ? '30' : '10'),
  };
  if (ultimo?.restSeconds) numeros.restSeconds = ultimo.restSeconds;
  if (ultimo?.rir !== undefined) numeros.rir = ultimo.rir;
  if (ultimo?.prescrito) numeros.prescrito = ultimo.prescrito;
  return numeros;
}

/**
 * El primer día de la semana (0 = lunes) que aún no tiene ningún día del plan.
 * Sin hueco, ninguno: que lo elija el entrenador.
 */
export function primerDiaLibre(dias: Pick<RoutineDay, 'weekday'>[]): number | undefined {
  const usados = new Set(dias.map((d) => d.weekday).filter((w) => w !== undefined));
  for (let w = 0; w < 7; w++) if (!usados.has(w)) return w;
  return undefined;
}

/**
 * Los ejercicios de un día plegado, en una línea: "Dominadas · Fondos +
 * Flexiones arqueras · Front lever". El "+" es la superserie. Así se repasa
 * la semana entera sin abrir día por día.
 */
export function resumenDeEjercicios(ejercicios: Pick<RoutineExercise, 'name' | 'supersetWithPrevious'>[]): string {
  return ejercicios
    .map((e, i) => (i === 0 ? e.name : `${e.supersetWithPrevious ? ' + ' : ' · '}${e.name}`))
    .join('');
}

/** Lo que se iguala en todo un día. Lo que no viene, no se toca. */
export interface Igualar {
  sets?: number;
  /** Para los que se miden en reps (y combos). */
  reps?: string;
  /** Para los isométricos. */
  segundos?: string;
  rir?: number;
  /** RPE, letras, tempo…: lo que el plan ponga en vez del RIR. */
  prescrito?: string;
  restSeconds?: number;
}

/**
 * IGUALAR UN DÍA: las mismas series, reps, RIR o descanso para todos sus
 * ejercicios de una vez. Las reps van solo a los que se miden en reps y los
 * segundos solo a los isométricos: a una plancha de 30 s no se le ponen "8".
 * Por lados, si el lado derecho tenía su número, se iguala con el izquierdo.
 */
export function igualarEjercicios(ejercicios: RoutineExercise[], v: Igualar): RoutineExercise[] {
  return ejercicios.map((e) => {
    const n: RoutineExercise = { ...e };
    if (v.sets) n.sets = v.sets;
    const marca = isHoldMeasure(e.measure) ? v.segundos : v.reps;
    if (marca) {
      n.reps = marca;
      if (isDualMeasure(e.measure) && e.side2) n.side2 = marca;
    }
    if (v.rir !== undefined) n.rir = v.rir;
    if (v.prescrito) n.prescrito = v.prescrito;
    if (v.restSeconds) n.restSeconds = v.restSeconds;
    return n;
  });
}

/*
 * LA SUPERSERIE SE HACE TODA JUNTA: UNAS SERIES Y UN DESCANSO PARA EL BLOQUE.
 *
 * Al unir dos ejercicios en superserie se hacen como uno: A, B, descanso, A,
 * B, descanso… No tiene sentido poner series y descanso en cada uno; el
 * editor los pide una vez, en el primero, y aquí se reparten a todos los del
 * bloque. Las reps y el RIR siguen siendo de cada ejercicio.
 *
 * (No es la fusión del plan personalizado, que junta rutinas enteras: esto es
 * la superserie de siempre, la que se une con la pastilla entre dos ejercicios.)
 */

/** ¿Encabeza una superserie (el siguiente va unido a él)? */
export function encabezaSuperserie(ejercicios: Pick<RoutineExercise, 'supersetWithPrevious'>[], i: number): boolean {
  return !ejercicios[i]?.supersetWithPrevious && !!ejercicios[i + 1]?.supersetWithPrevious;
}

/** ¿Va unido al anterior? (El primero del día nunca, lo diga o no.) */
export function vaEnSuperserie(ejercicios: Pick<RoutineExercise, 'supersetWithPrevious'>[], i: number): boolean {
  return i > 0 && !!ejercicios[i]?.supersetWithPrevious;
}

/** Las series y el descanso de UNO, puestos a todo su bloque. */
export function conLoDelBloque(
  ejercicios: RoutineExercise[],
  i: number,
  campos: Partial<Pick<RoutineExercise, 'sets' | 'restSeconds'>>
): RoutineExercise[] {
  const b = bloqueDe(ejercicios, i);
  return ejercicios.map((e, k) => (k >= b.inicio && k <= b.fin ? { ...e, ...campos } : e));
}

/**
 * Al unir el ejercicio `i` con el anterior: el bloque entero se queda con las
 * series y el descanso del PRIMERO, que son los que el editor enseña.
 */
export function alUnirConElAnterior(ejercicios: RoutineExercise[], i: number): RoutineExercise[] {
  const b = bloqueDe(ejercicios, i);
  const cabeza = ejercicios[b.inicio];
  if (!cabeza || b.fin === b.inicio) return ejercicios;
  return conLoDelBloque(ejercicios, i, {
    sets: cabeza.sets,
    ...(cabeza.restSeconds ? { restSeconds: cabeza.restSeconds } : {}),
  });
}

/**
 * Las superseries que ya estaban montadas, igualadas SIN CAMBIAR lo que el
 * alumno hacía: las rondas son las del que más series llevaba, y el descanso
 * el que ya se usaba al acabar cada ronda (el del último o, sin él, el mayor;
 * ver descansoDelBloque).
 */
export function unificarSuperseries(ejercicios: RoutineExercise[]): RoutineExercise[] {
  let salida = ejercicios;
  for (let i = 0; i < ejercicios.length; i++) {
    if (!encabezaSuperserie(ejercicios, i)) continue;
    const b = bloqueDe(ejercicios, i);
    const miembros = ejercicios.slice(b.inicio, b.fin + 1);
    const sets = Math.max(...miembros.map((e) => e.sets || 0));
    const descanso = descansoDelBloque(ejercicios, b);
    salida = conLoDelBloque(salida, i, {
      ...(sets > 0 ? { sets } : {}),
      ...(descanso > 0 ? { restSeconds: descanso } : {}),
    });
    i = b.fin;
  }
  return salida;
}
