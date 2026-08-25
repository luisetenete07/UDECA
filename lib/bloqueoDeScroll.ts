import { createContext, useContext } from 'react';

/**
 * Quedarse la pantalla quieta mientras se manipula algo dentro de ella.
 *
 * EL PROBLEMA
 *
 * El carné se gira arrastrándolo con el dedo. Pero vive dentro de una pantalla
 * que se desplaza, y en el móvil los dos gestos son el mismo: apoyar el dedo y
 * moverlo. Ganaba la pantalla, así que la tarjeta no había forma de girarla —
 * justo desde donde es más fácil agarrarla, que es el centro.
 *
 * POR QUÉ UN CONTEXTO Y NO UNA PROP
 *
 * Quien sabe que hay un gesto en marcha es la tarjeta; quien puede parar el
 * desplazamiento es el `ScrollView`, que está en `ScreenContainer`, cuatro
 * niveles más arriba. Encadenar una prop por ese camino obliga a que cada
 * pantalla intermedia la reenvíe, y basta que una se olvide para que el fallo
 * vuelva en esa sola pantalla, en silencio.
 *
 * Va por CUENTA y no por sí/no a propósito: si dos cosas piden quieto a la vez,
 * la primera en soltar no debe devolver el movimiento mientras la otra sigue.
 *
 * SIN PROVEEDOR NO PASA NADA
 *
 * El valor por defecto no hace nada, así que un componente que se use fuera de
 * una pantalla con desplazamiento sigue funcionando igual.
 */
export interface BloqueoDeScroll {
  /** Pide que la pantalla se quede quieta. */
  bloquear: () => void;
  /** Devuelve el movimiento. Hay que llamarlo tantas veces como a `bloquear`. */
  soltar: () => void;
}

const SIN_EFECTO: BloqueoDeScroll = { bloquear: () => {}, soltar: () => {} };

export const ContextoDeBloqueo = createContext<BloqueoDeScroll>(SIN_EFECTO);

export function useBloqueoDeScroll(): BloqueoDeScroll {
  return useContext(ContextoDeBloqueo);
}
