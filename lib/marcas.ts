import { bestsByExercise, detectNewPRs, type ExerciseBest } from './stats';
import type { WorkoutLog } from './types';

/**
 * Cuántas veces se ha superado a sí mismo.
 *
 * EL CAMBIO Y POR QUÉ. La clasificación del mes contaba DÍAS SEGUIDOS. Eso
 * premia aparecer, no mejorar: quien hace lo mismo cada día durante un mes
 * gana a quien entrena cuatro veces por semana y sube en todo. Y como la racha
 * se rompe sola en cuanto hay una gripe o un viaje, a mitad de mes la mitad
 * del grupo ya sabe que no puede ganar y deja de mirar.
 *
 * Contar MARCAS SUPERADAS arregla las dos cosas. Premia exactamente lo que un
 * entrenador quiere que pase —que la gente mejore— y no se rompe: un mal fin
 * de semana no te quita las marcas que ya batiste.
 *
 * QUÉ CUENTA COMO MARCA lo decide `detectNewPRs`, la MISMA función que celebra
 * el récord en pantalla cuando lo consigues. Es deliberado: si la
 * clasificación tuviera su propia idea de lo que es un récord, antes o después
 * contaría uno que la app no celebró —o al revés— y nadie entendería su propio
 * puesto.
 *
 * Un ejercicio solo puede dar UN récord por sesión (lo impone `detectNewPRs`),
 * así que no se puede inflar el número repitiendo series flojas.
 */

export interface MarcasDelPeriodo {
  /** Cuántas veces superó una marca suya dentro del periodo. */
  superadas: number;
  /** En cuántas sesiones distintas lo hizo. */
  sesiones: number;
}

/**
 * Recorre el historial en orden y cuenta los récords caídos en la ventana.
 *
 * Se recorre TODO el historial y no solo el mes: una marca del día 3 solo es
 * récord si supera lo que había antes, y "antes" empieza el primer día que
 * esa persona entrenó. Contando solo el mes, cualquiera batiría récords en
 * enero por el simple hecho de que enero empieza vacío.
 *
 * Las mejores marcas se llevan al día a mano en vez de recalcularlas en cada
 * paso: con dos años de historial, recalcular sería recorrer el historial
 * entero una vez por sesión.
 */
export function marcasSuperadas(
  logs: WorkoutLog[],
  desde: number,
  hasta: number = Number.MAX_SAFE_INTEGER
): MarcasDelPeriodo {
  const orden = [...logs].sort((a, b) => a.date - b.date);
  const bests: Record<string, ExerciseBest> = {};
  let superadas = 0;
  let sesiones = 0;

  for (const log of orden) {
    // `history` va vacío a propósito: las marcas de antes se pasan ya
    // calculadas en `bests`, que es lo que este recorrido lleva al día.
    const prs = detectNewPRs([], log.exercises, bests);
    if (log.date >= desde && log.date <= hasta) {
      superadas += prs.length;
      if (prs.length > 0) sesiones += 1;
    }
    // Y después se incorporan las de esta sesión, para la siguiente vuelta.
    absorbe(bests, log);
  }

  return { superadas, sesiones };
}

/** Mete las marcas de una sesión en el acumulado. */
function absorbe(bests: Record<string, ExerciseBest>, log: WorkoutLog): void {
  const deLaSesion = bestsByExercise([log]);
  for (const [id, b] of Object.entries(deLaSesion)) {
    const previo = bests[id];
    if (!previo) {
      bests[id] = { ...b };
      continue;
    }
    if (b.bestLoadKg > previo.bestLoadKg) {
      previo.bestLoadKg = b.bestLoadKg;
      previo.bestRepsAtLoad = b.bestRepsAtLoad;
    } else if (b.bestLoadKg === previo.bestLoadKg && b.bestRepsAtLoad > previo.bestRepsAtLoad) {
      previo.bestRepsAtLoad = b.bestRepsAtLoad;
    }
    if (b.bestReps > previo.bestReps) previo.bestReps = b.bestReps;
    if (b.hasUnassisted) previo.hasUnassisted = true;
  }
}

/** Las de ESTE mes, que es lo que ordena la clasificación. */
export function marcasDelMes(logs: WorkoutLog[], ahora = Date.now()): number {
  const d = new Date(ahora);
  const inicio = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  return marcasSuperadas(logs, inicio, ahora).superadas;
}

/** Las del mes ANTERIOR, para el podio del cambio de mes. */
export function marcasDelMesPasado(logs: WorkoutLog[], ahora = Date.now()): number {
  const d = new Date(ahora);
  const inicio = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
  const fin = new Date(d.getFullYear(), d.getMonth(), 1).getTime() - 1;
  return marcasSuperadas(logs, inicio, fin).superadas;
}

/**
 * Cómo se dice el número.
 *
 * "28" a secas no significa nada: hay que decir de qué. Y en singular no se
 * pone el "x1", que se lee como un error.
 */
export function textoDeMarcas(n: number): string {
  if (n <= 0) return 'Sin marcas nuevas';
  if (n === 1) return 'Superado 1 vez';
  return `Superado x${n} veces`;
}

/** La versión corta, para la fila del ranking. */
export function marcasCortas(n: number): string {
  return n === 1 ? '1 marca' : `${n} marcas`;
}
