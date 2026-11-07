import { inicioDelDia, masDias } from './fechas';
import type { CoachTask } from './types';

/**
 * LOS HÁBITOS DEL ENTRENADOR: lo que quiere hacer cada día (leer, grabar
 * contenido, entrenar él), en su panel, encima de los pendientes.
 *
 * Cada hábito guarda los DÍAS en que se marcó. Hecho hoy es que esté el de
 * hoy: al día siguiente sale sin marcar solo, sin que nada tenga que
 * desmarcarlo a medianoche. Y con los días se ve la racha y la semana.
 *
 * Van con las tareas del entrenador (`coachTasks`, scope 'habit'): son suyas,
 * nadie más las ve, y se borran con su cuenta como el resto.
 */

/** Días que se guardan de cada hábito: de sobra para la racha y la semana. */
export const DIAS_GUARDADOS = 120;

export function esHabito(t: Pick<CoachTask, 'scope'>): boolean {
  return t.scope === 'habit';
}

export function habitos(tasks: CoachTask[]): CoachTask[] {
  return tasks.filter(esHabito).sort((a, b) => a.order - b.order);
}

/** ¿Marcado hoy? */
export function hechoHoy(h: Pick<CoachTask, 'dias'>, ahora = Date.now()): boolean {
  return (h.dias ?? []).includes(inicioDelDia(ahora));
}

/** Los días con el de hoy puesto o quitado: ordenados, sin repetir y sin los muy viejos. */
export function conHoyAlternado(dias: number[] | undefined, ahora = Date.now()): number[] {
  const hoy = inicioDelDia(ahora);
  const set = new Set((dias ?? []).map((d) => inicioDelDia(d)));
  if (set.has(hoy)) set.delete(hoy);
  else set.add(hoy);
  return [...set].sort((a, b) => a - b).slice(-DIAS_GUARDADOS);
}

/**
 * Días seguidos marcados hasta hoy. Si hoy aún no está, la racha sigue viva
 * hasta ayer: el día no ha terminado.
 */
export function racha(dias: number[] | undefined, ahora = Date.now()): number {
  const set = new Set((dias ?? []).map((d) => inicioDelDia(d)));
  let dia = inicioDelDia(ahora);
  if (!set.has(dia)) dia = masDias(dia, -1);
  let n = 0;
  while (set.has(dia)) {
    n++;
    dia = masDias(dia, -1);
  }
  return n;
}

/** Los últimos 7 días (el último, hoy): si se marcó cada uno. */
export function ultimaSemana(dias: number[] | undefined, ahora = Date.now()): { dia: number; hecho: boolean }[] {
  const set = new Set((dias ?? []).map((d) => inicioDelDia(d)));
  const hoy = inicioDelDia(ahora);
  return Array.from({ length: 7 }, (_, i) => {
    const dia = masDias(hoy, i - 6);
    return { dia, hecho: set.has(dia) };
  });
}

/** Cuántos hechos hoy, de cuántos. */
export function resumenDeHoy(lista: Pick<CoachTask, 'dias'>[], ahora = Date.now()): { hechos: number; total: number } {
  return { hechos: lista.filter((h) => hechoHoy(h, ahora)).length, total: lista.length };
}
