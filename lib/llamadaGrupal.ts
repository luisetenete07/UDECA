import { diasEntre, masDias } from './fechas';

/*
 * LLAMADAS GRUPALES: EL ENTRENADOR CON TODOS SUS ALUMNOS A LA VEZ.
 *
 * Una sesión de preguntas, una charla del mes, una clase en directo. El
 * entrenador la programa una vez (título, día, hora, duración y el enlace de
 * su Meet, Zoom o lo que use) y elige DESDE CUÁNTOS DÍAS ANTES la tienen sus
 * alumnos fijada en su inicio: por ejemplo, 7. Desde las 00:00 de ese día y
 * hasta que termina, a cada alumno le sale arriba, con cuánto falta y el
 * botón para entrar; y le llega el aviso.
 *
 * Como en las llamadas 1:1, CALICO solo pone el cuándo: la llamada en sí va
 * por el enlace del entrenador.
 *
 * Todo lo que decide esto es puro, sin Firestore ni pantallas, para poder
 * probarlo entero (scripts/check-llamada-grupal.mjs).
 */

export interface LlamadaGrupal {
  id: string;
  trainerId: string;
  titulo: string;
  /** De qué va o qué preparar, si el entrenador lo pone. */
  nota?: string;
  /** El enlace de la llamada (https://…). Sin él, el entrenador dirá por dónde. */
  enlace?: string;
  inicio: number;
  duracionMin: number;
  /** Desde cuántos días antes la tiene cada alumno fijada en su inicio. */
  diasAntes: number;
  createdAt: number;
}

/** Lo que escribe el entrenador. */
export type BorradorDeGrupal = Pick<LlamadaGrupal, 'titulo' | 'nota' | 'enlace' | 'inicio' | 'duracionMin' | 'diasAntes'>;

export const DURACIONES_GRUPALES = [30, 45, 60, 90, 120] as const;
/** 0 es "el mismo día". */
export const DIAS_ANTES = [0, 1, 2, 3, 7, 14, 30] as const;
export const DIAS_ANTES_POR_DEFECTO = 7;
export const MAX_DIAS_ANTES = 60;
export const MAX_TITULO = 80;
export const MAX_NOTA = 500;

const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;

export function finDe(l: Pick<LlamadaGrupal, 'inicio' | 'duracionMin'>): number {
  return l.inicio + l.duracionMin * MINUTO;
}

/**
 * Desde cuándo la tiene fijada: las 00:00 del día que cae `diasAntes` días
 * antes, en la hora de quien la mira. Con 7, una llamada del jueves a las 19:00
 * sale desde el jueves anterior por la mañana, no desde las 19:00 de ese día.
 */
export function fijadaDesde(l: Pick<LlamadaGrupal, 'inicio' | 'diasAntes'>): number {
  return masDias(l.inicio, -Math.max(0, l.diasAntes));
}

/** ¿La tiene fijada ahora? Desde ese día hasta que la llamada termina. */
export function estaFijada(l: Pick<LlamadaGrupal, 'inicio' | 'duracionMin' | 'diasAntes'>, ahora = Date.now()): boolean {
  return ahora >= fijadaDesde(l) && ahora < finDe(l);
}

/** Las que tiene fijadas ahora, la más próxima primero. */
export function fijadasAhora<T extends Pick<LlamadaGrupal, 'inicio' | 'duracionMin' | 'diasAntes'>>(
  lista: T[],
  ahora = Date.now()
): T[] {
  return lista.filter((l) => estaFijada(l, ahora)).sort((a, b) => a.inicio - b.inicio);
}

/** Las que aún no han terminado, la más próxima primero. */
export function proximasGrupales<T extends Pick<LlamadaGrupal, 'inicio' | 'duracionMin'>>(
  lista: T[],
  ahora = Date.now()
): T[] {
  return lista.filter((l) => finDe(l) > ahora).sort((a, b) => a.inicio - b.inicio);
}

/**
 * Cuándo le LLEGA al alumno: el día que empieza a estar fijada, o al crearla
 * si ya tocaba tenerla fijada. Es la hora con la que cuenta como notificación
 * nueva (el punto de la campana).
 */
export function llegaEl(l: Pick<LlamadaGrupal, 'inicio' | 'diasAntes' | 'createdAt'>): number {
  return Math.max(fijadaDesde(l), l.createdAt);
}

/** Cuántas le han llegado desde la última vez que miró sus notificaciones. */
export function grupalesSinVer(
  lista: Pick<LlamadaGrupal, 'inicio' | 'duracionMin' | 'diasAntes' | 'createdAt'>[],
  vistos?: number,
  ahora = Date.now()
): number {
  return lista.filter((l) => estaFijada(l, ahora) && llegaEl(l) > (vistos ?? 0)).length;
}

/** La más reciente en llegar (para dar por visto hasta ahí). 0 si no hay. */
export function ultimaEnLlegar(
  lista: Pick<LlamadaGrupal, 'inicio' | 'duracionMin' | 'diasAntes' | 'createdAt'>[],
  ahora = Date.now()
): number {
  return Math.max(0, ...fijadasAhora(lista, ahora).map(llegaEl));
}

/**
 * ¿Hay que mandar el aviso al móvil AL CREARLA? Solo si ya le toca estar
 * fijada: si no, el aviso sale el día que empieza a estarlo (lo programa el
 * móvil de cada alumno, ver `avisosDeGrupal`).
 */
export function avisarAlCrear(l: Pick<LlamadaGrupal, 'inicio' | 'duracionMin' | 'diasAntes'>, ahora = Date.now()): boolean {
  return estaFijada(l, ahora);
}

/** A qué hora del día en que empieza a estar fijada se avisa (no a las 00:00). */
export const HORA_DEL_AVISO = 10;

/**
 * Los avisos que programa el móvil del alumno para una llamada:
 *  - 'fijada': el día que empieza a estar fijada, a las 10:00. Solo si se creó
 *    ANTES de ese día (si se creó dentro, el aviso ya le llegó al crearla) y si
 *    no cae a menos de una hora de la llamada (para eso está el otro).
 *  - 'una-hora': una hora antes de empezar.
 * Solo los que aún no han pasado.
 */
export function avisosDeGrupal(
  l: Pick<LlamadaGrupal, 'inicio' | 'diasAntes' | 'createdAt'>,
  ahora = Date.now()
): { tipo: 'fijada' | 'una-hora'; cuando: number }[] {
  const avisos: { tipo: 'fijada' | 'una-hora'; cuando: number }[] = [];
  const desde = fijadaDesde(l);
  const alFijarse = desde + HORA_DEL_AVISO * HORA;
  const unaHora = l.inicio - HORA;
  if (desde > l.createdAt && alFijarse > ahora && alFijarse < unaHora) avisos.push({ tipo: 'fijada', cuando: alFijarse });
  if (unaHora > ahora) avisos.push({ tipo: 'una-hora', cuando: unaHora });
  return avisos;
}

/** Cuánto falta, para decirlo en la tarjeta. */
export type Falta =
  | { cuando: 'directo' }
  | { cuando: 'minutos'; n: number }
  | { cuando: 'hoy' }
  | { cuando: 'manana' }
  | { cuando: 'dias'; n: number };

export function faltaPara(l: Pick<LlamadaGrupal, 'inicio'>, ahora = Date.now()): Falta {
  if (ahora >= l.inicio) return { cuando: 'directo' };
  const min = Math.ceil((l.inicio - ahora) / MINUTO);
  if (min <= 60) return { cuando: 'minutos', n: min };
  const dias = diasEntre(ahora, l.inicio);
  if (dias <= 0) return { cuando: 'hoy' };
  if (dias === 1) return { cuando: 'manana' };
  return { cuando: 'dias', n: dias };
}

/** ¿Es ya la hora de entrar? (Un cuarto de hora antes, y mientras dura.) */
export function esHoraDeEntrar(l: Pick<LlamadaGrupal, 'inicio' | 'duracionMin'>, ahora = Date.now()): boolean {
  return ahora >= l.inicio - 15 * MINUTO && ahora < finDe(l);
}

export type ProblemaDeGrupal = 'sin-titulo' | 'pasada' | 'enlace' | 'duracion' | 'dias-antes';

export const TEXTO_DEL_PROBLEMA: Record<ProblemaDeGrupal, string> = {
  'sin-titulo': 'Ponle un título a la llamada.',
  pasada: 'Elige un día y una hora que aún no hayan pasado.',
  enlace: 'El enlace tiene que empezar por https://',
  duracion: 'Elige cuánto dura la llamada.',
  'dias-antes': 'Elige desde cuándo la ven fijada tus alumnos.',
};

/** Lo que impide guardarla, o null si está bien. */
export function problemaDeGrupal(b: BorradorDeGrupal, ahora = Date.now()): ProblemaDeGrupal | null {
  if (!b.titulo.trim()) return 'sin-titulo';
  if (!Number.isFinite(b.inicio) || b.inicio <= ahora) return 'pasada';
  const enlace = b.enlace?.trim();
  if (enlace && !/^https?:\/\/\S+$/i.test(enlace)) return 'enlace';
  if (!Number.isInteger(b.duracionMin) || b.duracionMin < 5 || b.duracionMin > 240) return 'duracion';
  if (!Number.isInteger(b.diasAntes) || b.diasAntes < 0 || b.diasAntes > MAX_DIAS_ANTES) return 'dias-antes';
  return null;
}

/** Lo que se guarda: recortado, y sin la nota ni el enlace si están vacíos. */
export function grupalParaGuardar(b: BorradorDeGrupal): BorradorDeGrupal {
  const nota = b.nota?.trim().slice(0, MAX_NOTA);
  const enlace = b.enlace?.trim();
  return {
    titulo: b.titulo.trim().slice(0, MAX_TITULO),
    ...(nota ? { nota } : {}),
    ...(enlace ? { enlace } : {}),
    inicio: Math.round(b.inicio),
    duracionMin: b.duracionMin,
    diasAntes: b.diasAntes,
  };
}

/**
 * Al cambiarla, ¿hay algo que sus alumnos tengan que saber? El día, la hora,
 * la duración, el enlace o el título. La nota o desde cuándo sale fijada, no:
 * eso no hace falta mandarlo al móvil de nadie.
 */
export function cambioQueAvisar(antes: BorradorDeGrupal, despues: BorradorDeGrupal): boolean {
  return (
    antes.inicio !== despues.inicio ||
    antes.duracionMin !== despues.duracionMin ||
    (antes.enlace ?? '') !== (despues.enlace ?? '') ||
    antes.titulo.trim() !== despues.titulo.trim()
  );
}
