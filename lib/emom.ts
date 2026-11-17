import { frase, t } from './idioma';
import { bloqueDe } from './superserie';
import { isDualMeasure, isHoldMeasure, type ExerciseMeasure, type RoutineDay, type RoutineExercise } from './types';

/**
 * EL EMOM DEL DÍA (every minute on the minute).
 *
 * El entrenador marca un día como EMOM en el editor de la rutina
 * (`showIntervalTimer`) y elige cada cuánto empieza una ronda
 * (`emomSegundos`, un minuto si no dice nada). El alumno ve en Entreno un
 * contador hecho para eso: cuánto queda de la ronda, en qué ronda va, qué toca
 * ahora y qué viene después. Lo que sobra de cada ronda es el descanso.
 *
 * LAS RONDAS SALEN DEL PLAN, no se configuran aparte: cada ejercicio hace
 * tantas rondas como series le puso el entrenador, y si hay varios se turnan
 * (minuto 1 dominadas, minuto 2 fondos, minuto 3 dominadas…). Una superserie
 * va entera en la misma ronda. Así un EMOM de 10 minutos de dominadas es
 * "Dominadas, 10 series de 5", que es como ya se escribe.
 *
 * El contador se guarda por la HORA a la que arrancó, no por lo que lleva:
 * aunque se bloquee el móvil o se cierre la app, al volver marca la ronda en
 * la que de verdad se está.
 */

/** Cuenta atrás para colocarse antes de la primera ronda. */
export const PREVIA_MS = 10_000;
export const INTERVALO_POR_DEFECTO = 60;
/** Lo que el entrenador puede elegir, en segundos. */
export const INTERVALOS = [30, 45, 60, 90, 120, 180] as const;
/** Más de una hora de EMOM no es un EMOM: es un error al escribir las series. */
export const MAX_RONDAS = 60;
/** Los últimos segundos de cada ronda se cuentan en voz alta (un pitido cada uno). */
export const SEGUNDOS_DE_AVISO = 3;
export const CLAVE_EMOM = 'calico:emom';

/** Cada cuánto empieza una ronda en este día. */
export function intervaloDelDia(day: Pick<RoutineDay, 'emomSegundos'>): number {
  const s = Math.round(day.emomSegundos ?? 0);
  return s >= 10 && s <= 600 ? s : INTERVALO_POR_DEFECTO;
}

/** 60 → "1 min", 90 → "1:30", 45 → "45 s". */
export function textoDelIntervalo(segundos: number): string {
  if (segundos < 60) return `${segundos} s`;
  if (segundos % 60 === 0) return `${segundos / 60} min`;
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}

/**
 * Las rondas del EMOM: en cada una, los índices de los ejercicios que se hacen.
 *
 * Por turnos entre bloques (un ejercicio suelto o una superserie entera), y
 * cada bloque tantas veces como series tenga. En una superserie, un ejercicio
 * con menos series deja de salir cuando se le acaban.
 */
export function rondasDelEmom(ejercicios: Pick<RoutineExercise, 'sets' | 'supersetWithPrevious'>[]): number[][] {
  const bloques: number[][] = [];
  for (let i = 0; i < ejercicios.length; ) {
    const b = bloqueDe(ejercicios, i);
    bloques.push(Array.from({ length: b.fin - b.inicio + 1 }, (_, k) => b.inicio + k));
    i = b.fin + 1;
  }
  const series = (i: number) => Math.max(1, Math.round(ejercicios[i].sets || 1));
  const vueltas = bloques.map((b) => Math.max(...b.map(series)));
  const rondas: number[][] = [];
  for (let vuelta = 0; rondas.length < MAX_RONDAS; vuelta++) {
    let alguna = false;
    for (let k = 0; k < bloques.length && rondas.length < MAX_RONDAS; k++) {
      if (vuelta >= vueltas[k]) continue;
      rondas.push(bloques[k].filter((i) => vuelta < series(i)));
      alguna = true;
    }
    if (!alguna) break;
  }
  return rondas;
}

/** Lo que se hace en la ronda: "5 reps", "30 s", "8 + 8 reps", "5 reps + 10 s". */
export function cuantoDe(ex: Pick<RoutineExercise, 'reps' | 'seconds' | 'side2'>, medida?: ExerciseMeasure): string {
  const reps = ex.reps?.trim() ?? '';
  const segundos = ex.seconds?.trim() ?? '';
  const otroLado = isDualMeasure(medida) && ex.side2?.trim() ? ` + ${ex.side2.trim()}` : '';
  // "Máx." o "AMRAP" van tal cual: "AMRAP reps" no se lee.
  const conUnidad = (v: string, unidad: string) => (/\d/.test(v) ? `${v}${otroLado} ${unidad}` : v);
  if (isHoldMeasure(medida)) {
    const v = segundos || reps;
    return v ? conUnidad(v, 's') : '';
  }
  if (medida === 'combo') {
    return [reps ? conUnidad(reps, 'reps') : '', segundos ? `${segundos} s` : ''].filter(Boolean).join(' + ');
  }
  return reps ? conUnidad(reps, 'reps') : '';
}

/** "10 rondas, una cada minuto" / "8 rondas, una cada 45 s". */
export function resumenDelEmom(rondas: number, intervalo: number): string {
  const cuantas = rondas === 1 ? t('1 ronda') : frase`${rondas} rondas`;
  return intervalo === 60 ? frase`${cuantas}, una cada minuto` : frase`${cuantas}, una cada ${textoDelIntervalo(intervalo)}`;
}

/* ------------------------------------------------------------------ */
/* El contador                                                         */
/* ------------------------------------------------------------------ */

export interface EstadoEmom {
  /** El día del plan al que pertenece: otro día empieza de cero. */
  dia: string;
  /** Cuándo arrancó (o siguió tras una pausa). Sin valor, está parado. */
  desde: number | null;
  /** Lo que llevaba antes de la última pausa, en ms. */
  acumulado: number;
}

export const emomParado = (dia: string): EstadoEmom => ({ dia, desde: null, acumulado: 0 });

export function enMarcha(e: EstadoEmom): boolean {
  return e.desde !== null;
}

/** Ms desde que se pulsó "Empezar", contando la previa y sin las pausas. */
export function transcurridoEmom(e: EstadoEmom, ahora: number): number {
  return e.acumulado + (e.desde !== null ? Math.max(0, ahora - e.desde) : 0);
}

export function arrancarEmom(e: EstadoEmom, ahora: number): EstadoEmom {
  return e.desde !== null ? e : { ...e, desde: ahora };
}

export function pausarEmom(e: EstadoEmom, ahora: number): EstadoEmom {
  return e.desde === null ? e : { ...e, desde: null, acumulado: transcurridoEmom(e, ahora) };
}

/** Lo guardado en el móvil, si es de este día y se puede leer. */
export function leerEmom(texto: string | null | undefined, dia: string): EstadoEmom {
  if (!texto) return emomParado(dia);
  try {
    const v = JSON.parse(texto);
    if (v?.dia !== dia) return emomParado(dia);
    const acumulado = typeof v.acumulado === 'number' && v.acumulado >= 0 ? v.acumulado : 0;
    const desde = typeof v.desde === 'number' && v.desde > 0 ? v.desde : null;
    return { dia, desde, acumulado };
  } catch {
    return emomParado(dia);
  }
}

export type Momento =
  | { fase: 'previa'; quedanMs: number }
  /** `ronda` empieza en 0. */
  | { fase: 'ronda'; ronda: number; quedanMs: number }
  | { fase: 'fin' };

/** Dónde se está: colocándose, en qué ronda y cuánto le queda, o terminado. */
export function momentoDelEmom(ms: number, intervalo: number, total: number): Momento {
  if (ms < PREVIA_MS) return { fase: 'previa', quedanMs: PREVIA_MS - ms };
  const largo = intervalo * 1000;
  const t = ms - PREVIA_MS;
  const ronda = Math.floor(t / largo);
  if (ronda >= total) return { fase: 'fin' };
  return { fase: 'ronda', ronda, quedanMs: largo - (t % largo) };
}

/** Los segundos que se enseñan: 60 al empezar, 1 justo antes de cambiar. */
export function segundosQueSeVen(m: Momento): number {
  return m.fase === 'fin' ? 0 : Math.ceil(m.quedanMs / 1000);
}

/** "0:42", "1:30". */
export function mmss(segundos: number): string {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
}

/**
 * Qué aviso toca al pasar de un momento al siguiente: 'ronda' al empezar una,
 * 'cuenta' en cada uno de los últimos segundos, 'fin' al acabar.
 *
 * Sin momento anterior (se acaba de abrir la pantalla con el EMOM en marcha)
 * no suena nada: se engancha callado a donde va.
 */
export function avisoAlPasar(antes: Momento | null, ahora: Momento): 'ronda' | 'cuenta' | 'fin' | null {
  if (!antes) return null;
  if (ahora.fase === 'fin') return antes.fase === 'fin' ? null : 'fin';
  if (ahora.fase === 'ronda' && (antes.fase !== 'ronda' || antes.ronda !== ahora.ronda)) return 'ronda';
  if (antes.fase !== ahora.fase) return null;
  const s = segundosQueSeVen(ahora);
  return s <= SEGUNDOS_DE_AVISO && s !== segundosQueSeVen(antes) ? 'cuenta' : null;
}

/**
 * Cuándo empieza cada ronda que aún no ha empezado, en ms desde ahora. Para
 * los avisos del sistema, que suenan aunque el móvil esté bloqueado.
 */
export function proximasRondas(ms: number, intervalo: number, total: number, tope: number): { ronda: number; enMs: number }[] {
  const fuera: { ronda: number; enMs: number }[] = [];
  for (let r = 0; r <= total && fuera.length < tope; r++) {
    // r === total es el final: también se avisa.
    const empieza = PREVIA_MS + r * intervalo * 1000;
    if (empieza > ms) fuera.push({ ronda: r, enMs: empieza - ms });
  }
  return fuera;
}
