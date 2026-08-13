/**
 * De qué tamaño se ve un vídeo cuando se amplía.
 *
 * EL PROBLEMA: en un portátil, un vídeo metido en una columna de contenido de
 * 860 px ocupa un tercio de la pantalla. Para ver una técnica —dónde va el
 * codo, cuánto se abre la escápula— eso no da. Y la solución obvia, la pantalla
 * completa del navegador o del sistema, es justo la que no se puede usar aquí:
 * ahí el vídeo lo pinta el sistema operativo POR ENCIMA de todo, incluida la
 * marca de agua con el nombre de quien mira y el cristal que tapa los controles
 * de YouTube. Se ganaría tamaño y se perdería todo el blindaje de una vez.
 *
 * LA SOLUCIÓN es esta: casi toda la pantalla, pero dentro de la app. El vídeo
 * sigue siendo un elemento nuestro, con la marca de agua encima y sin acceso a
 * los controles de la plataforma. Se ve grande y sigue protegido.
 *
 * Los márgenes no son estéticos: si el vídeo llegara justo al borde, el gesto
 * de cerrar no tendría dónde empezar y en iOS chocaría con el de volver atrás.
 */

/** Cuánto del ancho de la ventana se puede usar. */
export const ANCHO_MAXIMO = 0.96;

/**
 * Cuánto del alto. Menos que el ancho a propósito: hay que dejar sitio para el
 * botón de cerrar y para el título, y un vídeo que llega al borde de arriba en
 * un móvil se mete debajo de la muesca.
 */
export const ALTO_MAXIMO = 0.8;

/** La relación de siempre. Los vídeos de técnica y los cursos son 16:9. */
export const RELACION = 16 / 9;

export interface TamanoDelVisor {
  width: number;
  height: number;
}

/**
 * El vídeo más grande que cabe, respetando su forma.
 *
 * Se prueba primero por ancho —que es lo que limita en un móvil— y si el alto
 * resultante no cabe, se recalcula desde el alto. Hacerlo al revés dejaría
 * vídeos altísimos en pantallas apaisadas.
 */
export function tamanoDelVisor(
  anchoVentana: number,
  altoVentana: number,
  relacion = RELACION
): TamanoDelVisor {
  const r = relacion > 0 ? relacion : RELACION;
  const anchoTope = Math.max(0, anchoVentana) * ANCHO_MAXIMO;
  const altoTope = Math.max(0, altoVentana) * ALTO_MAXIMO;

  let width = anchoTope;
  let height = width / r;
  if (height > altoTope) {
    height = altoTope;
    width = height * r;
  }
  return { width: Math.round(width), height: Math.round(height) };
}

/**
 * ¿Merece la pena ofrecer "ampliar"?
 *
 * En un móvil el vídeo ya ocupa casi todo el ancho: un botón para agrandarlo
 * un 4 % es un botón que miente. Se ofrece cuando de verdad se gana tamaño.
 */
export function mereceAmpliar(anchoDelVideo: number, anchoVentana: number, altoVentana: number): boolean {
  const { width } = tamanoDelVisor(anchoVentana, altoVentana);
  return width > anchoDelVideo * 1.15;
}
