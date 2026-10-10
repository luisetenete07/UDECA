import { coachingDe } from './coaching';
import { diasEntre } from './fechas';
import { pausaActiva } from './pausa';
import type { UserProfile, WorkoutLog } from './types';

/**
 * Quién lleva días sin entrenar, para el "Necesita tu atención" del coach.
 *
 * El panel ya decía "3 sin entrenar" esta semana, pero un número no dice a
 * QUIÉN escribir. Esto da la lista, con los días de cada uno, y deja fuera a
 * quien no entrena por una razón que el coach ya conoce:
 *
 *  - Con el plan en pausa (lesión, viaje): no entrenar es justo lo acordado.
 *  - Con la app en pausa porque se acabó su periodo: eso ya sale como "periodo
 *    terminado", y salir dos veces es ruido.
 *  - Recién llegado: quien entró hace dos días todavía no ha tenido tiempo.
 */

/** A partir de cuántos días sin entrenar se avisa. */
export const DIAS_SIN_ENTRENAR = 5;

export interface SinEntrenar {
  alumno: UserProfile;
  /** Días desde su último entreno; `null` si aún no ha hecho ninguno. */
  dias: number | null;
}

export function alumnosSinEntrenar(
  clients: UserProfile[],
  logs: WorkoutLog[],
  ahora: number = Date.now()
): SinEntrenar[] {
  const ultimo = new Map<string, number>();
  for (const l of logs) {
    if (l.date > (ultimo.get(l.clientId) ?? 0)) ultimo.set(l.clientId, l.date);
  }
  const lista: SinEntrenar[] = [];
  for (const c of clients) {
    if (pausaActiva(c.planPauses, ahora)) continue;
    if (coachingDe(c, ahora).estado === 'pausado') continue;
    const u = ultimo.get(c.uid);
    if (u === undefined) {
      if (c.createdAt && diasEntre(c.createdAt, ahora) < DIAS_SIN_ENTRENAR) continue;
      lista.push({ alumno: c, dias: null });
      continue;
    }
    const dias = diasEntre(u, ahora);
    if (dias >= DIAS_SIN_ENTRENAR) lista.push({ alumno: c, dias });
  }
  // El que más lleva, primero. Los que aún no han empezado, al final: es otra
  // conversación ("¿cómo vas con el arranque?"), no la de "te echo de menos".
  return lista.sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1));
}
