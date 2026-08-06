import type { RoutineDay, RoutineSchedule } from './types';

/**
 * Cuánto va a pedir un entrenamiento, y cómo se dice.
 *
 * Hay dos escalas y no es un descuido:
 *
 * - En un CICLO la intensidad es del día que toca, y se lee en la escala del
 *   Método REIN TENA (1-10). Es la que el entrenador ya usa y no se toca.
 * - En SENSACIONES no hay día que toca: hay varias rutinas y el alumno elige
 *   según cómo se encuentre. Lo que necesita antes de elegir es cuánto le va a
 *   pedir cada una, y un porcentaje se compara de un vistazo ("hoy no estoy
 *   para el 90 %") de una forma que un 9/10 no consigue.
 *
 * Todo lo que pinta intensidad pasa por aquí. Antes cada pantalla se montaba
 * su `${day.intensity ?? 5}/10`, y por eso Sensaciones se quedó sin ninguna:
 * no había un sitio donde faltara, faltaba en todos a la vez.
 */

/** Escalón del porcentaje. Un 5 % arriba o abajo se nota; un 1 %, no. */
export const PASO_PCT = 5;
export const MIN_PCT = 40;
export const MAX_PCT = 100;

/** Lo que se enseña, ya escrito. `null` si ese día no tiene intensidad. */
export function textoIntensidad(
  day: Pick<RoutineDay, 'intensity' | 'intensityPct' | 'isRest'> | null | undefined,
  schedule: RoutineSchedule | undefined
): string | null {
  if (!day || day.isRest) return null;
  if (schedule === 'flex') {
    return day.intensityPct ? `${day.intensityPct} %` : null;
  }
  return day.intensity ? `${day.intensity}/10` : null;
}

/**
 * La intensidad en 0..1, para pintar barras y aros con la misma vara.
 * `null` cuando ese día no tiene intensidad puesta.
 */
export function proporcionIntensidad(
  day: Pick<RoutineDay, 'intensity' | 'intensityPct' | 'isRest'> | null | undefined,
  schedule: RoutineSchedule | undefined
): number | null {
  if (!day || day.isRest) return null;
  if (schedule === 'flex') {
    return day.intensityPct ? Math.min(1, day.intensityPct / 100) : null;
  }
  return day.intensity ? Math.min(1, day.intensity / 10) : null;
}

/** Sube o baja el porcentaje sin salirse del rango. */
export function ajustaPct(actual: number | undefined, delta: number): number {
  const base = actual ?? 70;
  const siguiente = base + delta * PASO_PCT;
  return Math.max(MIN_PCT, Math.min(MAX_PCT, siguiente));
}

/**
 * Una palabra para el porcentaje: lo que de verdad se decide al elegir rutina.
 * El número está para quien lo quiera; la palabra, para quien no.
 */
export function esfuerzoDePct(pct: number | undefined): string | null {
  if (!pct) return null;
  if (pct <= 55) return 'Suave';
  if (pct <= 75) return 'Medio';
  if (pct <= 90) return 'Fuerte';
  return 'Máximo';
}

/**
 * Cuando el alumno encadena varias rutinas el mismo día, manda la más dura.
 *
 * Sumar los porcentajes no significa nada (un 50 % y un 60 % no son un 110 %),
 * y promediarlos mentiría a la baja: hacer un día suave ANTES de uno fuerte no
 * hace que la sesión sea medio fuerte, la hace fuerte y con más fatiga
 * acumulada. Quedarse con el máximo es lo único que no engaña.
 */
export function pctCombinado(
  dias: Pick<RoutineDay, 'intensityPct'>[]
): number | undefined {
  const valores = dias.map((d) => d.intensityPct).filter((v): v is number => !!v);
  return valores.length > 0 ? Math.max(...valores) : undefined;
}
