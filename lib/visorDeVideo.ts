import { esVertical } from './video';

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
 *
 * Se probó a subirlo para que los verticales se vieran más y NO sirve de nada:
 * en un móvil de pie lo que limita es el ancho (un vertical sale 374×666 en un
 * 390×844, muy por debajo del tope de alto), así que subirlo no gana un píxel
 * donde hacía falta. Y en un móvil TUMBADO sí cambia, para mal: ahí el alto es
 * lo único que hay, y el hueco que queda para la barra del título y el aviso ya
 * es justo. Se queda en 0,80.
 */
export const ALTO_MAXIMO = 0.8;

/** La relación de siempre. Los vídeos de técnica y los cursos son 16:9. */
export const RELACION = 16 / 9;

/**
 * La de un vertical: los Shorts y lo que se graba con el móvil de pie.
 *
 * Forzarlos a 16:9 no los recortaba —el reproductor respeta la forma— pero los
 * dejaba en una columna en medio de dos barras negras enormes. En un móvil de
 * 390 el vídeo útil se quedaba en 118 px de ancho: menos de un tercio de la
 * pantalla para lo único que importa mirar.
 */
export const RELACION_VERTICAL = 9 / 16;

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
 * La forma que le toca a este vídeo.
 *
 * Vive aquí, junto a los tamaños, y no en cada pantalla: la relación la usan el
 * visor ampliado y el reproductor de dentro de la página, y si cada uno la
 * decide por su cuenta acaban discrepando — el vídeo pequeño vertical y el
 * grande apaisado, o al revés.
 */
export function relacionDelVideo(url: string | undefined | null): number {
  return url && esVertical(url) ? RELACION_VERTICAL : RELACION;
}

/*
 * LA PANTALLA COMPLETA, LA NUESTRA
 *
 * Lo que se pidió: que un vídeo de técnica o de un curso, al abrirlo, se vea a
 * pantalla completa y en la mejor calidad. La pantalla completa del sistema
 * sigue sin valer —encima de ella no hay marca de agua ni tapa de la barra de
 * YouTube—, así que es una pantalla completa DENTRO de la app: el vídeo ocupa
 * la pantalla entera, de borde a borde, y sigue siendo un elemento nuestro.
 *
 * Y la calidad sale de aquí también. YouTube no deja pedirle una calidad desde
 * fuera (quitó esa opción); la elige él según el tamaño del reproductor y la
 * conexión. Cuanto más grande es el reproductor, más alta la que escoge, así
 * que darle la pantalla entera es lo que de verdad sube la calidad.
 *
 * EL MÓVIL DE PIE
 *
 * La app va siempre en vertical, y un vídeo apaisado en un móvil de pie se
 * queda en una franja: 390×219 en una pantalla de 390×844, un cuarto de lo que
 * hay. Se hace lo que hacen todas las apps de vídeo: el vídeo se pinta GIRADO,
 * para ver con el móvil tumbado, y entonces ocupa 693×390, el triple.
 *
 * Se gira el vídeo y no la app porque la app tiene la orientación bloqueada, y
 * desbloquearla es tocar la configuración nativa de las dos tiendas para todas
 * las pantallas. Esto solo toca el visor.
 *
 * Donde la ventana YA está tumbada (un ordenador, una tablet girada, el
 * navegador del móvil al girarlo) no se gira nada: ya cabe tal cual. Y los
 * verticales (Shorts) nunca: de pie es justo como se ven enteros.
 */

/** Cómo se coloca el vídeo cuando se abre a pantalla completa. */
export interface PantallaCompleta {
  /** Si se pinta girado 90° para verlo con el móvil tumbado. */
  girado: boolean;
  /** El lienzo donde va el vídeo, ya en su orientación (girado, el ancho es el alto de la pantalla). */
  ancho: number;
  alto: number;
  /** El vídeo dentro del lienzo: lo más grande que cabe sin deformarlo. */
  video: TamanoDelVisor;
}

/** ¿Tiene sentido girar este vídeo en esta ventana? Apaisado en una ventana de pie. */
export function sePuedeGirar(anchoVentana: number, altoVentana: number, relacion = RELACION): boolean {
  return relacion > 1 && altoVentana > anchoVentana;
}

/**
 * El vídeo a toda la pantalla.
 *
 * `enVertical` es la elección de quien mira: hay quien prefiere no tumbar el
 * móvil (lo tiene apoyado, está con una mano), y para eso está el botón de
 * girar. Por defecto se gira, que es lo que llena la pantalla.
 */
export function pantallaCompleta(
  anchoVentana: number,
  altoVentana: number,
  relacion = RELACION,
  enVertical = false
): PantallaCompleta {
  const w = Math.max(0, anchoVentana);
  const h = Math.max(0, altoVentana);
  const r = relacion > 0 ? relacion : RELACION;
  const girado = !enVertical && sePuedeGirar(w, h, r);
  const ancho = girado ? h : w;
  const alto = girado ? w : h;
  let vw = ancho;
  let vh = vw / r;
  if (vh > alto) {
    vh = alto;
    vw = vh * r;
  }
  return { girado, ancho, alto, video: { width: Math.round(vw), height: Math.round(vh) } };
}

/**
 * Los márgenes seguros del sistema (muesca, barra de inicio) vistos desde el
 * lienzo GIRADO.
 *
 * Girado 90° a la derecha, lo de arriba del lienzo es el lado derecho del
 * móvil, su derecha es la parte de abajo (donde está la barra de inicio), su
 * abajo es el lado izquierdo y su izquierda es arriba, donde está la muesca.
 * Sin este cambio, el botón de cerrar caería debajo de la barra de inicio.
 */
export function margenesDelLienzo(
  m: { top: number; right: number; bottom: number; left: number },
  girado: boolean
): { top: number; right: number; bottom: number; left: number } {
  if (!girado) return m;
  return { top: m.right, right: m.bottom, bottom: m.left, left: m.top };
}
