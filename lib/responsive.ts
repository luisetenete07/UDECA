import { useWindowDimensions } from 'react-native';
import { spacing } from './theme';

/**
 * Sistema de disposición por tamaño de pantalla.
 *
 * El problema que resuelve: la app se diseñó para el móvil y en pantallas
 * grandes se estiraba. Una ficha de alumno de 1400 px de ancho con el nombre
 * pegado al borde izquierdo y la flecha a 1350 px de distancia no es "adaptado",
 * es el diseño de móvil deformado.
 *
 * La regla: el ancho extra NO se usa para hacer las filas más largas, sino para
 * poner MÁS COLUMNAS. Es lo que hacen Linear, Stripe o Notion, y es lo que hace
 * que una lista se lea igual de bien en un móvil que en un monitor.
 */

export type Breakpoint = 'phone' | 'tablet' | 'laptop' | 'desktop';

/** Cortes en px de ancho de ventana. */
export const BREAKPOINTS = {
  tablet: 600,
  laptop: 1024,
  desktop: 1440,
} as const;

/**
 * Ancho máximo de la columna de contenido.
 *
 * Por encima de esto el texto se vuelve incómodo de leer (la vista pierde el
 * renglón) y las filas se quedan huecas. El espacio sobrante queda de margen a
 * los lados, que es lo correcto: no es "espacio vacío", es respiración.
 */
export const CONTENT_MAX_WIDTH = 1200;

export interface Layout {
  width: number;
  bp: Breakpoint;
  /** Móvil: la única disposición de una sola columna. */
  isPhone: boolean;
  /** Tablet en adelante: hay sitio para rejilla y para acciones en línea. */
  isWide: boolean;
  /** Margen lateral de la pantalla, proporcional al tamaño. */
  gutter: number;
  /** Ancho máximo de la columna de contenido. */
  maxWidth: number;
  /** Columnas recomendadas para una rejilla de tarjetas. */
  columns: number;
}

export function useLayout(): Layout {
  const { width } = useWindowDimensions();
  const bp: Breakpoint =
    width < BREAKPOINTS.tablet
      ? 'phone'
      : width < BREAKPOINTS.laptop
        ? 'tablet'
        : width < BREAKPOINTS.desktop
          ? 'laptop'
          : 'desktop';

  return {
    width,
    bp,
    isPhone: bp === 'phone',
    isWide: bp !== 'phone',
    // El margen crece con la pantalla: pegado al borde en móvil se ve pobre, y
    // un margen fijo de 24 px en un monitor se ve descuidado.
    gutter: bp === 'phone' ? spacing.lg : bp === 'tablet' ? spacing.xl : spacing.xxl,
    maxWidth: CONTENT_MAX_WIDTH,
    columns: bp === 'phone' ? 1 : bp === 'tablet' ? 2 : bp === 'laptop' ? 2 : 3,
  };
}
