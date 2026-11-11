/*
 * EL TEMPORIZADOR DE DESCANSO SUELTO.
 *
 * Para el alumno que entrena sin rutina en la app (su entrenador se la pasa
 * por otro lado, o aún no se la ha puesto): no tiene series que marcar, así
 * que el descanso no le salta solo. Aquí elige cuánto quiere descansar y lo
 * lanza a mano; la cuenta atrás es la misma del entreno
 * (lib/restTimerStore.ts): sigue aunque cambie de pantalla, avisa al terminar
 * y se puede alargar.
 *
 * Lo que decide esto es puro, para poder probarlo (scripts/check-crono-libre.mjs).
 */

/** Los tiempos de un toque: los descansos de siempre. */
export const PRESETS = [30, 45, 60, 90, 120, 180, 300] as const;
/** Lo que suma o quita cada botón de − y +. */
export const PASO = 15;
export const MINIMO = 5;
export const MAXIMO = 15 * 60;
export const POR_DEFECTO = 90;
/** Donde se recuerda el último tiempo elegido, en el propio móvil. */
export const CLAVE = 'calico:descansoLibre';

export function acotar(segundos: number): number {
  if (!Number.isFinite(segundos)) return POR_DEFECTO;
  return Math.min(MAXIMO, Math.max(MINIMO, Math.round(segundos)));
}

/** 90 → "1:30", 45 → "0:45". */
export function mmss(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Cómo se lee un tiempo en un botón: "30 s", "1 min", "1:30", "5 min". */
export function etiquetaDeTiempo(segundos: number): string {
  if (segundos < 60) return `${segundos} s`;
  return segundos % 60 === 0 ? `${segundos / 60} min` : mmss(segundos);
}

/**
 * − y + van de 15 en 15 y se ajustan a la marca: desde 50 s, + lleva a 1:00 y
 * − a 45 s (no a 65 y 35, que no son tiempos que nadie use).
 */
export function conPaso(segundos: number, sentido: 1 | -1): number {
  const base = acotar(segundos);
  const siguiente =
    sentido > 0 ? Math.floor(base / PASO) * PASO + PASO : Math.ceil(base / PASO) * PASO - PASO;
  return acotar(siguiente);
}

/**
 * Lo que escribe el alumno, en segundos: "1:20" o "1.20" o "1'20" son un
 * minuto y veinte; un número solo son segundos ("50", "90"). null si no se
 * entiende.
 */
export function leerTiempo(escrito: string): number | null {
  const t = escrito.trim().replace(/\s+/g, '');
  if (!t) return null;
  const conMinutos = /^(\d{1,2})[:.'’](\d{1,2})$/.exec(t);
  if (conMinutos) {
    const s = Number(conMinutos[2]);
    if (s > 59) return null;
    return acotar(Number(conMinutos[1]) * 60 + s);
  }
  if (/^\d{1,4}$/.test(t)) return acotar(Number(t));
  return null;
}

/** Lo guardado en el móvil, o el de por defecto si no hay nada que valga. */
export function tiempoGuardado(guardado: string | null | undefined): number {
  const n = Number(guardado);
  return guardado && Number.isFinite(n) ? acotar(n) : POR_DEFECTO;
}
