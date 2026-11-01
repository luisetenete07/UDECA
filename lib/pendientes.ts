import type { CoachTask } from './types';

/**
 * LOS PENDIENTES DEL ENTRENADOR: lo que tiene que hacer sin fecha.
 *
 * "Llamar a Marta", "grabar el vídeo del muscle up", "renovar el seguro". No
 * son de un día —si se le pone uno, se queda escondido en ese día y al pasar
 * se olvida— ni son objetivos con porcentaje. Son una lista, como la de un
 * papel en la nevera: se apunta, se tacha, y lo importante arriba.
 *
 * Las tareas de las antiguas listas de "Semana" y "Mes" son exactamente esto:
 * cosas sin día. Salen aquí con las demás.
 *
 * Si un pendiente acaba teniendo fecha, se le pone día y pasa al calendario.
 */

/** ¿Va en la lista de pendientes (sin día)? */
export function esPendiente(t: Pick<CoachTask, 'scope'>): boolean {
  return t.scope === 'pending' || t.scope === 'week' || t.scope === 'month';
}

/** Lo que queda por hacer: lo destacado arriba, y lo demás en el orden en que se apuntó. */
export function pendientesPorHacer(tasks: CoachTask[]): CoachTask[] {
  return tasks
    .filter((t) => esPendiente(t) && !t.done)
    .sort((a, b) => Number(!!b.flagged) - Number(!!a.flagged) || a.order - b.order);
}

/** Cuántos días se enseñan los ya tachados (para poder deshacer un toque sin querer). */
export const DIAS_DE_HECHOS = 7;

/** Lo tachado hace poco, lo último primero. */
export function pendientesHechos(tasks: CoachTask[], ahora = Date.now()): CoachTask[] {
  const desde = ahora - DIAS_DE_HECHOS * 86_400_000;
  return tasks
    .filter((t) => esPendiente(t) && t.done && (t.doneAt ?? t.updatedAt ?? 0) >= desde)
    .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
}
