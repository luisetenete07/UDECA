/**
 * EL CRONÓMETRO DEL ENTRENO (components/Cronometro.tsx).
 *
 * Cuenta hacia arriba: una isométrica, un circuito, una vuelta a la pista.
 * La cuenta atrás es otra cosa y ya existe (lib/restTimerStore.ts).
 *
 * Se guarda la HORA a la que arrancó, no los segundos que lleva. Así sigue
 * siendo exacto aunque la pantalla se apague, se cambie de pestaña o se cierre
 * la app: al volver se resta la hora de ahora y sale lo que de verdad ha
 * pasado. Contando de uno en uno, cualquier pausa del sistema se lo comería.
 */

export interface EstadoCronometro {
  /** Cuándo arrancó la tanda que está corriendo (ms). `null` = parado. */
  desde: number | null;
  /** Lo que llevaba de las tandas anteriores (ms). */
  acumulado: number;
  /** Las vueltas, como tiempo total en el momento de marcarlas (ms). */
  vueltas: number[];
}

export const PARADO: EstadoCronometro = { desde: null, acumulado: 0, vueltas: [] };

/** Las vueltas que se guardan: más no caben en la pantalla ni hacen falta. */
export const MAX_VUELTAS = 30;

export const CLAVE_CRONOMETRO = 'calico:cronometro';

export function corriendo(e: EstadoCronometro): boolean {
  return e.desde !== null;
}

/** Lo que marca el cronómetro ahora mismo, en ms. */
export function transcurrido(e: EstadoCronometro, ahora: number): number {
  return e.acumulado + (e.desde !== null ? Math.max(0, ahora - e.desde) : 0);
}

export function arrancar(e: EstadoCronometro, ahora: number): EstadoCronometro {
  return e.desde !== null ? e : { ...e, desde: ahora };
}

export function pausar(e: EstadoCronometro, ahora: number): EstadoCronometro {
  return e.desde === null ? e : { ...e, desde: null, acumulado: transcurrido(e, ahora) };
}

export function conVuelta(e: EstadoCronometro, ahora: number): EstadoCronometro {
  const vueltas = [...e.vueltas, transcurrido(e, ahora)].slice(-MAX_VUELTAS);
  return { ...e, vueltas };
}

/** Lo que duró cada vuelta (la primera, desde cero). */
export function parciales(e: EstadoCronometro): number[] {
  return e.vueltas.map((v, i) => v - (i > 0 ? e.vueltas[i - 1] : 0));
}

/**
 * Como se lee un cronómetro: "0:07.4", "1:30.0", "1:02:15".
 *
 * Las décimas solo por debajo de la hora: en una isométrica importan; en una
 * hora y cuarto de bici, no, y alargan el número.
 */
export function textoDelCronometro(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 100));
  const decimas = total % 10;
  const s = Math.floor(total / 10);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const dos = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${dos(m)}:${dos(r)}` : `${m}:${dos(r)}.${decimas}`;
}

/** Lo guardado en el móvil, o parado si no hay nada o no se entiende. */
export function leerCronometro(guardado: string | null | undefined): EstadoCronometro {
  if (!guardado) return PARADO;
  try {
    const x = JSON.parse(guardado);
    const desde = typeof x?.desde === 'number' && Number.isFinite(x.desde) ? x.desde : null;
    const acumulado = typeof x?.acumulado === 'number' && x.acumulado >= 0 ? x.acumulado : 0;
    const vueltas = Array.isArray(x?.vueltas)
      ? x.vueltas.filter((v: unknown) => typeof v === 'number' && v >= 0).slice(-MAX_VUELTAS)
      : [];
    return { desde, acumulado, vueltas };
  } catch {
    return PARADO;
  }
}
