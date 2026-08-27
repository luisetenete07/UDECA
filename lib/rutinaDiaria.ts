import { esMismoDia } from './fechas';
import { frase } from './idioma';
import type { DiaDeRutinaDiaria, RutinaDiaria } from './types';

/**
 * La rutina diaria: cuánto llevas hoy y qué se te dice.
 *
 * Aquí no se importa nada de la app —ni React Native ni Firebase— para poder
 * comprobar estas cuentas en Node pelado. Lo que decide si alguien ve su rutina
 * y si la da por hecha no puede quedarse sin probar.
 */

/** Nombre por omisión, si el entrenador no le pone uno. */
export const NOMBRE_POR_DEFECTO = 'Tu rutina diaria';

/** ¿Se le enseña algo al alumno? */
export function hayRutinaDiaria(r: RutinaDiaria | null | undefined): boolean {
  return !!r && r.activa && r.ejercicios.length > 0;
}

/** Lo hecho HOY, o nada si el registro es de otro día. */
export function hechosDeHoy(
  dia: DiaDeRutinaDiaria | null | undefined,
  ahora = Date.now()
): string[] {
  if (!dia || !esMismoDia(dia.date, ahora)) return [];
  return dia.hechos ?? [];
}

export interface ProgresoDiario {
  hechos: number;
  total: number;
  /** 0..1. Con la rutina vacía, 0 y no una división entre cero. */
  ratio: number;
  completa: boolean;
  quedan: number;
}

export function progresoDiario(
  rutina: RutinaDiaria | null | undefined,
  dia: DiaDeRutinaDiaria | null | undefined,
  ahora = Date.now()
): ProgresoDiario {
  const total = rutina?.ejercicios.length ?? 0;
  /*
   * Solo cuentan los ejercicios que SIGUEN en la rutina.
   *
   * Si el entrenador quita el pino a media semana, lo marcado ayer sobre el
   * pino no puede seguir contando hoy: se vería "4 de 3 hechos", que es la
   * clase de número que hace desconfiar de todo lo demás que dice la pantalla.
   */
  const vivos = new Set((rutina?.ejercicios ?? []).map((e) => e.id));
  const hechos = hechosDeHoy(dia, ahora).filter((id) => vivos.has(id)).length;
  return {
    hechos,
    total,
    ratio: total > 0 ? Math.min(1, hechos / total) : 0,
    completa: total > 0 && hechos >= total,
    quedan: Math.max(0, total - hechos),
  };
}

/**
 * Marca o desmarca un ejercicio, y devuelve la lista entera lista para guardar.
 *
 * Sin duplicados aunque se pulse dos veces seguidas: en un móvil con la pantalla
 * lenta, el doble toque es lo normal, no la excepción.
 */
export function conEjercicioMarcado(
  hechos: string[],
  id: string,
  marcado: boolean
): string[] {
  const sin = hechos.filter((x) => x !== id);
  return marcado ? [...sin, id] : sin;
}

/**
 * La línea que acompaña al progreso. Ni felicita de más ni riñe.
 *
 * El día a medias NO se cuenta como fallo: en algo que se repite a diario, dos
 * de tres es un día bueno. Tratarlo de otra forma enseña a abandonar en cuanto
 * se rompe la racha.
 */
export function textoDiario(p: ProgresoDiario): string {
  if (p.total === 0) return '';
  if (p.completa) return 'Hecha. Mañana otra vez.';
  // El singular importa: "1 cosas cortas" delata que nadie ha leído la
  // pantalla, y quien lo lee piensa lo mismo del resto de la app.
  if (p.hechos === 0) {
    return p.total === 1
      ? 'Una cosa corta, cuando puedas.'
      : frase`${p.total} cosas cortas, cuando puedas.`;
  }
  return frase`${p.hechos} de ${p.total}. Lo que caiga suma.`;
}
