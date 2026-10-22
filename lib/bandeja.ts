import { frase, t } from './idioma';
import { detectNewPRs } from './stats';
import type { ActividadDeLlamada } from './llamadas';
import type { WorkoutLog } from './types';

/*
 * LA BANDEJA "POR REVISAR" DEL ENTRENADOR.
 *
 * Sustituye a "Actividad reciente", que era una lista de lo último sin más:
 * había que abrir cada sesión para saber si había algo que mirar, y no se
 * sabía cuáles se habían mirado ya. Ahora:
 *
 *  - Salen los entrenos que el entrenador aún no ha abierto (de las dos
 *    últimas semanas), y al abrir uno deja de salir.
 *  - Cada uno dice de un vistazo POR QUÉ mirarlo: un récord, una nota del
 *    alumno, series sin hacer, un ejercicio saltado o uno al fallo.
 *  - "Marcar todo como visto" vacía la bandeja de golpe.
 *
 * Lo visto se guarda en el perfil del entrenador (`revisados`, los últimos
 * ids, y `revisadoHasta`), así que vale en el móvil y en el ordenador.
 */

const DIA = 24 * 60 * 60 * 1000;
/** Lo de más atrás ya no está "por revisar": es historia. */
export const DIAS_DE_BANDEJA = 14;
/** Ids de entrenos vistos que se recuerdan (los más recientes). */
export const MAX_REVISADOS = 200;

export interface LoVisto {
  revisados?: string[];
  revisadoHasta?: number;
}

/** Cuándo llegó el entreno: al guardarse, no el día que dice (puede ser de antes). */
function llegada(l: WorkoutLog): number {
  return l.createdAt ?? l.date;
}

/** Los entrenos por revisar, del más nuevo al más viejo. */
export function porRevisar(logs: WorkoutLog[], visto: LoVisto, ahora = Date.now()): WorkoutLog[] {
  const desde = Math.max(ahora - DIAS_DE_BANDEJA * DIA, visto.revisadoHasta ?? 0);
  const vistos = new Set(visto.revisados ?? []);
  return logs
    .filter((l) => llegada(l) > desde && !vistos.has(l.id))
    .sort((a, b) => llegada(b) - llegada(a));
}

/*
 * LAS LLAMADAS, EN LA MISMA BANDEJA.
 *
 * Cada vez que un alumno reserva o cancela una llamada, llega aquí como algo
 * nuevo, igual que un entreno: sale hasta que el entrenador lo abre o marca
 * todo como visto. Comparten la lista de vistos; el id de una llamada lleva
 * delante "llamada:" para no confundirse nunca con el de un entreno.
 */
export type EnLaBandeja =
  | { clase: 'entreno'; id: string; llegada: number; log: WorkoutLog }
  | { clase: 'llamada'; id: string; llegada: number; actividad: ActividadDeLlamada };

export const idEnLaBandeja = (a: Pick<ActividadDeLlamada, 'id'>) => `llamada:${a.id}`;

/** Todo lo que hay por revisar —entrenos y llamadas—, del más nuevo al más viejo. */
export function bandeja(
  logs: WorkoutLog[],
  actividad: ActividadDeLlamada[],
  visto: LoVisto,
  ahora = Date.now()
): EnLaBandeja[] {
  const desde = Math.max(ahora - DIAS_DE_BANDEJA * DIA, visto.revisadoHasta ?? 0);
  const vistos = new Set(visto.revisados ?? []);
  const entrenos: EnLaBandeja[] = porRevisar(logs, visto, ahora).map((log) => ({
    clase: 'entreno',
    id: log.id,
    llegada: llegada(log),
    log,
  }));
  const llamadas: EnLaBandeja[] = actividad
    .filter((a) => a.cuando > desde && !vistos.has(idEnLaBandeja(a)))
    .map((a) => ({ clase: 'llamada', id: idEnLaBandeja(a), llegada: a.cuando, actividad: a }));
  return [...entrenos, ...llamadas].sort((a, b) => b.llegada - a.llegada);
}

/** La lista de vistos con uno más (el primero), sin pasarse del tope. */
export function conRevisado(revisados: string[] | undefined, id: string): string[] {
  return [id, ...(revisados ?? []).filter((x) => x !== id)].slice(0, MAX_REVISADOS);
}

export interface Destacado {
  icono: 'trophy' | 'chatbox-ellipses-outline' | 'remove-circle-outline' | 'play-skip-forward-outline' | 'flame-outline';
  texto: string;
  tono: 'logro' | 'aviso' | 'normal';
}

/**
 * Por qué mirar este entreno, en pastillas cortas. Vacío si fue "normal".
 *
 * `historial` son los entrenos del MISMO alumno (de cualquier fecha): de ellos
 * se sacan sus marcas de antes para saber si hoy batió alguna.
 */
export function loQueDestaca(log: WorkoutLog, historial: WorkoutLog[]): Destacado[] {
  const out: Destacado[] = [];
  const antes = historial.filter((l) => l.id !== log.id && l.date < log.date);
  const records = detectNewPRs(antes, log.exercises).length;
  if (records > 0) {
    out.push({ icono: 'trophy', texto: records === 1 ? t('1 récord') : frase`${records} récords`, tono: 'logro' });
  }
  const conNota = log.exercises.filter((e) => e.notes?.trim()).length + (log.feedback?.trim() ? 1 : 0);
  if (conNota > 0) {
    out.push({
      icono: 'chatbox-ellipses-outline',
      texto: conNota === 1 ? t('Ha dejado una nota') : frase`${conNota} notas`,
      tono: 'aviso',
    });
  }
  const sinHacer = log.exercises
    .filter((e) => !e.saltado)
    .reduce((n, e) => n + e.sets.filter((s) => !s.completed).length, 0);
  if (sinHacer > 0) {
    out.push({
      icono: 'remove-circle-outline',
      texto: sinHacer === 1 ? t('1 serie sin hacer') : frase`${sinHacer} series sin hacer`,
      tono: 'aviso',
    });
  }
  const saltados = log.exercises.filter((e) => e.saltado);
  if (saltados.length > 0) {
    out.push({
      icono: 'play-skip-forward-outline',
      texto: saltados.length === 1 ? frase`Saltó ${saltados[0].name}` : frase`Saltó ${saltados.length} ejercicios`,
      tono: 'aviso',
    });
  }
  const alFallo = log.exercises.filter((e) => e.rir === 0).length;
  if (alFallo > 0) {
    out.push({
      icono: 'flame-outline',
      texto: alFallo === 1 ? t('1 al fallo') : frase`${alFallo} al fallo`,
      tono: 'normal',
    });
  }
  return out;
}
