import { frase } from './idioma';
import type { ObjetivoDeCiclo, WorkoutLog } from './types';

/**
 * Los objetivos del ciclo: qué se persigue y cuánto falta.
 *
 * QUÉ ES UN OBJETIVO Y POR QUÉ NO ES TEXTO LIBRE
 *
 * Un ejercicio y un número: "Dominadas, 12 repeticiones". "Planche tuck, 20
 * segundos". Nada más.
 *
 * El ciclo ya tenía un `goal` de texto libre y se queda, porque hace falta para
 * la frase que explica el bloque ("preparar la planche"). Pero un texto no se
 * puede comparar con nada, así que no puede decirle a nadie cuánto le falta, y
 * eso —cuánto falta— es lo único que hace que un objetivo se mire dos veces.
 *
 * DE DÓNDE SALE EL PROGRESO
 *
 * De las marcas que ya se apuntan al entrenar. No hay que rellenar nada aparte
 * ni que el entrenador vaya moviendo un porcentaje a mano: un objetivo que hay
 * que actualizar a mano deja de estar actualizado la segunda semana, y entonces
 * miente, que es peor que no estar.
 *
 * Aquí no se importa nada de la app —ni React Native ni Firebase— para poder
 * probar estas cuentas en Node pelado.
 */

/** Lo que se mide. Es lo que decide cómo se lee un número. */
export type MedidaDeObjetivo = 'reps' | 'seg' | 'kg';

/**
 * La mejor marca de un ejercicio en todo el historial que se le pase.
 *
 * Solo cuentan las series COMPLETADAS: una serie a medio escribir no es una
 * marca, es alguien que estaba tecleando.
 */
export function mejorMarca(
  logs: WorkoutLog[],
  ejercicioId: string,
  medida: MedidaDeObjetivo
): number {
  let mejor = 0;
  for (const log of logs ?? []) {
    for (const ex of log.exercises ?? []) {
      if (ex.exerciseId !== ejercicioId) continue;
      for (const set of ex.sets ?? []) {
        if (!set.completed) continue;
        if (medida === 'kg') {
          const kg = Number(set.weight);
          if (Number.isFinite(kg) && kg > mejor) mejor = kg;
          continue;
        }
        /*
         * Las repeticiones y los segundos viven en el mismo campo: en un
         * isométrico, "20" son veinte segundos. Y un clúster son varios
         * números en una sola serie, así que se miran todos.
         */
        for (const trozo of [set.reps, ...(set.clusters ?? [])]) {
          const n = Number.parseInt(String(trozo ?? ''), 10);
          if (Number.isFinite(n) && n > mejor) mejor = n;
        }
      }
    }
  }
  return mejor;
}

export interface ProgresoDeObjetivo {
  /** La mejor marca de hoy. */
  actual: number;
  /** Lo que se persigue. */
  meta: number;
  /** 0..1. Con meta cero, 0 y no una división entre cero. */
  ratio: number;
  logrado: boolean;
  /** Lo que falta. Cero si ya está. */
  falta: number;
}

export function progresoDeObjetivo(
  objetivo: ObjetivoDeCiclo,
  logs: WorkoutLog[]
): ProgresoDeObjetivo {
  const meta = Math.max(0, Number(objetivo.meta) || 0);
  const actual = objetivo.ejercicioId ? mejorMarca(logs, objetivo.ejercicioId, objetivo.medida) : 0;
  return {
    actual,
    meta,
    ratio: meta > 0 ? Math.min(1, actual / meta) : 0,
    logrado: meta > 0 && actual >= meta,
    falta: Math.max(0, meta - actual),
  };
}

/** Cómo se escribe un número según lo que mide. */
export function unidad(n: number, medida: MedidaDeObjetivo): string {
  if (medida === 'seg') return frase`${n} s`;
  if (medida === 'kg') return frase`${n} kg`;
  return n === 1 ? frase`1 repetición` : frase`${n} repeticiones`;
}

/**
 * La línea que lee el alumno. Ni felicita de más ni regaña.
 *
 * Sin ninguna marca todavía NO se dice "0 de 12": eso parece un suspenso el
 * primer día. Se dice que aún no hay nada que comparar, que es la verdad.
 */
export function textoDeObjetivo(p: ProgresoDeObjetivo, medida: MedidaDeObjetivo): string {
  if (p.meta <= 0) return '';
  if (p.logrado) return frase`Conseguido: ${unidad(p.actual, medida)}`;
  if (p.actual <= 0) return frase`Sin marcas todavía. Objetivo: ${unidad(p.meta, medida)}`;
  // La unidad UNA vez, no tres. "9 repeticiones de 13 repeticiones · te faltan
  // 4 repeticiones" se lee como un formulario, no como una frase.
  return frase`${p.actual} de ${unidad(p.meta, medida)} · te faltan ${p.falta}`;
}

/**
 * Los objetivos ordenados como se leen: primero lo que falta, y lo conseguido
 * al final.
 *
 * Lo conseguido no se esconde —ver lo que ya has hecho es media gracia de tener
 * objetivos— pero tampoco puede tapar lo que queda por hacer.
 */
export function ordenados(
  objetivos: ObjetivoDeCiclo[],
  logs: WorkoutLog[]
): ObjetivoDeCiclo[] {
  return [...(objetivos ?? [])].sort((a, b) => {
    const pa = progresoDeObjetivo(a, logs);
    const pb = progresoDeObjetivo(b, logs);
    if (pa.logrado !== pb.logrado) return pa.logrado ? 1 : -1;
    // Entre los que faltan, primero el que está más cerca: es el que se puede
    // caer esta semana, y verlo arriba es lo que hace ir a por él.
    return pb.ratio - pa.ratio;
  });
}

/** Cuántos hay y cuántos están. Para el resumen de la cabecera. */
export function resumen(objetivos: ObjetivoDeCiclo[], logs: WorkoutLog[]) {
  const total = (objetivos ?? []).length;
  const hechos = (objetivos ?? []).filter((o) => progresoDeObjetivo(o, logs).logrado).length;
  return { total, hechos, todos: total > 0 && hechos === total };
}

/**
 * Lee la meta que se teclea en el editor.
 *
 * Vacío es `undefined` —sin poner— y no cero: un objetivo de cero está
 * conseguido antes de empezar y no significa nada.
 */
export function metaDeTexto(texto: string): number | undefined {
  const limpio = (texto ?? '').replace(/[^0-9]/g, '');
  if (!limpio) return undefined;
  const n = Number.parseInt(limpio, 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(MAX_META, n);
}

/** Un tope para que un dedo que resbala no guarde un objetivo de 9.999. */
export const MAX_META = 999;
