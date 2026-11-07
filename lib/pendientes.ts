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

/**
 * Al llegar la lista del servidor, lo que se acaba de apuntar y aún se está
 * guardando (id provisional `tmp-`) no se pierde: si no, apuntar algo justo
 * mientras el panel carga lo borraba de la pantalla.
 */
export function conLoQueSeEstaGuardando(delServidor: CoachTask[], enPantalla: CoachTask[]): CoachTask[] {
  const guardando = enPantalla.filter((t) => t.id.startsWith('tmp-'));
  return guardando.length ? [...delServidor, ...guardando] : delServidor;
}

/** Ya guardado: el provisional pasa a tener su id. Si la carga ya lo trajo, no sale dos veces. */
export function conIdGuardado(lista: CoachTask[], provisional: string, id: string): CoachTask[] {
  return lista.some((t) => t.id === id)
    ? lista.filter((t) => t.id !== provisional)
    : lista.map((t) => (t.id === provisional ? { ...t, id } : t));
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
