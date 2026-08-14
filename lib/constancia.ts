import { inicioDeLaSemana, inicioDelDia, masDias } from './fechas';
import type { TrainingCycle } from './types';

/**
 * La constancia, medida sobre el BLOQUE que se está entrenando.
 *
 * Antes era una cuadrícula fija de doce semanas al lado de otra tarjeta que
 * hablaba del bloque en curso. Dos cuadrículas, dos periodos distintos y
 * ninguna forma de relacionarlas: se veía el reparto de un bloque de seis
 * semanas y, debajo, los puntos de tres meses. Comparar eso mentalmente no lo
 * hace nadie, así que la segunda tarjeta se miraba como un adorno.
 *
 * Ahora las dos hablan del mismo periodo: el bloque. "Cómo se reparte tu
 * trabajo en este bloque" y "qué días has entrenado en este bloque" sí se leen
 * juntas, porque la segunda explica la primera.
 *
 * Sin bloque en curso se cae a las últimas cuatro semanas, que es exactamente
 * el periodo que el reparto usa cuando no hay ciclo. Que las dos mitades de
 * una misma tarjeta hablen de periodos distintos sería el mismo fallo de
 * antes, más escondido.
 */

const DIA_MS = 24 * 60 * 60 * 1000;

/** Semanas sin bloque. Las mismas que usa el reparto en ese caso. */
export const SEMANAS_SIN_BLOQUE = 4;

/**
 * Tope de columnas. Con más, las celdas se hacen ilegibles en un móvil, y un
 * macrociclo de nueve meses las llevaría a un píxel de ancho.
 */
export const MAX_SEMANAS = 16;

export interface VentanaDeConstancia {
  /** Lunes de la primera semana que se pinta. */
  desde: number;
  /** Último día que cuenta (hoy, o el fin del bloque si ya pasó). */
  hasta: number;
  /** Cuántas columnas pintar. */
  semanas: number;
  /** Nombre de lo que se está mirando, para el rótulo. */
  titulo: string;
  /** true si de verdad hay un bloque detrás. */
  hayBloque: boolean;
}

/** Qué periodo se pinta: el del bloque, o las últimas cuatro semanas. */
export function ventanaDeConstancia(
  cycle: TrainingCycle | null | undefined,
  ahora = Date.now()
): VentanaDeConstancia {
  const hoy = inicioDelDia(ahora);

  if (!cycle?.startDate) {
    return {
      desde: masDias(inicioDeLaSemana(hoy), -7 * (SEMANAS_SIN_BLOQUE - 1)),
      hasta: hoy,
      semanas: SEMANAS_SIN_BLOQUE,
      titulo: `Últimas ${SEMANAS_SIN_BLOQUE} semanas`,
      hayBloque: false,
    };
  }

  const desde = inicioDeLaSemana(inicioDelDia(cycle.startDate));
  // El bloque puede haber terminado ya (se mira uno pasado): entonces la
  // ventana acaba donde acabó él, no hoy, o saldrían semanas vacías que no
  // eran suyas.
  const fin = cycle.endDate ? Math.min(hoy, inicioDelDia(cycle.endDate)) : hoy;
  const hasta = Math.max(desde, fin);
  const semanas = Math.min(
    MAX_SEMANAS,
    Math.max(1, Math.ceil((hasta - desde) / (7 * DIA_MS)) + 1)
  );

  return { desde, hasta, semanas, titulo: cycle.name, hayBloque: true };
}

export interface ResumenDeConstancia {
  /** Días entrenados dentro de la ventana. */
  entrenados: number;
  /** Días transcurridos de la ventana (nunca cuenta el futuro). */
  transcurridos: number;
  /** 0..1. */
  ratio: number;
  /** Cuántos días seguidos sin entrenar hay ahora mismo. */
  sinEntrenar: number;
  /** La frase de debajo de la cuadrícula. */
  texto: string;
}

/**
 * Lo que dice la cuadrícula, en una frase.
 *
 * Un mapa de puntos es bonito y no se lee: hay que contarlos para saber si vas
 * bien. La frase da el número, que es lo que se venía a saber.
 */
export function resumenDeConstancia(
  dias: Set<number>,
  ventana: VentanaDeConstancia,
  ahora = Date.now()
): ResumenDeConstancia {
  const hoy = inicioDelDia(ahora);
  const fin = Math.min(ventana.hasta, hoy);
  let entrenados = 0;
  let transcurridos = 0;
  for (let d = ventana.desde; d <= fin; d = masDias(d, 1)) {
    transcurridos += 1;
    if (dias.has(d)) entrenados += 1;
  }

  // Días seguidos sin entrenar, contando hacia atrás desde hoy. Es el dato que
  // hace levantarse del sofá, y no sale en ninguna cuadrícula.
  let sinEntrenar = 0;
  for (let d = hoy; d >= ventana.desde; d = masDias(d, -1)) {
    if (dias.has(d)) break;
    sinEntrenar += 1;
  }

  const ratio = transcurridos > 0 ? entrenados / transcurridos : 0;
  const cuantos = `${entrenados} ${entrenados === 1 ? 'día entrenado' : 'días entrenados'} de ${transcurridos}`;
  const texto =
    entrenados === 0
      ? ventana.hayBloque
        ? 'Aún no has entrenado en este bloque.'
        : 'Aún no has entrenado estas semanas.'
      : sinEntrenar >= 3
        ? `${cuantos} · llevas ${sinEntrenar} días sin entrenar`
        : cuantos;

  return { entrenados, transcurridos, ratio, sinEntrenar, texto };
}
