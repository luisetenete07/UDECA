import { inicioDelDia, masDias } from './fechas';

/**
 * Los avisos de la rutina de cada día (grease the groove).
 *
 * El grease the groove vive de repartir series cortas a lo largo del día, y lo
 * que se reparte a lo largo del día se olvida a lo largo del día. Hasta ahora
 * la tarjeta del inicio solo se veía si se abría la app; ahora el móvil avisa
 * unas pocas veces, a horas fijas, mientras quede algo por marcar.
 *
 * Reglas:
 *  - Cuatro avisos como mucho al día, separados tres horas: es un recordatorio,
 *    no una alarma.
 *  - Hoy, solo los que quedan por delante, y ninguno si ya está todo hecho.
 *  - Los días siguientes se dejan puestos también (un aviso local solo se
 *    puede programar con la app abierta, y el día que hace falta es justo el
 *    que no se abre). Cada vez que se abre o se marca algo, se rehacen.
 */

/** Horas a las que avisa, en punto. */
export const HORAS_DEL_GTG = [10, 13, 16, 19] as const;

/** Días que se dejan programados, contando hoy. */
export const DIAS_DE_AVISOS_GTG = 3;

/** Margen mínimo: un aviso para dentro de un minuto no avisa, molesta. */
const MARGEN_MS = 5 * 60 * 1000;

export interface AvisoDelGtg {
  cuando: number;
  esHoy: boolean;
}

export function avisosDelGtg(quedanHoy: number, ahora: number = Date.now()): AvisoDelGtg[] {
  const hoy = inicioDelDia(ahora);
  const lista: AvisoDelGtg[] = [];
  for (let d = 0; d < DIAS_DE_AVISOS_GTG; d++) {
    if (d === 0 && quedanHoy <= 0) continue;
    const dia = masDias(hoy, d);
    for (const h of HORAS_DEL_GTG) {
      const cuando = new Date(dia);
      cuando.setHours(h, 0, 0, 0);
      if (cuando.getTime() < ahora + MARGEN_MS) continue;
      lista.push({ cuando: cuando.getTime(), esHoy: d === 0 });
    }
  }
  return lista;
}
