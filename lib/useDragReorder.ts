import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  type GestureResponderHandlers,
  type LayoutChangeEvent,
  type PanResponderInstance,
} from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Reordenar arrastrando: se mantiene pulsado y se mueve arriba o abajo.
 *
 * Sustituye a las flechitas de subir/bajar de un escalón, que para mover un
 * ejercicio seis puestos obligaban a seis toques y a mirar dónde va cayendo.
 *
 * Está hecho con `PanResponder` y `Animated`, que vienen en React Native, en vez
 * de con una librería de gestos: son cero dependencias nuevas, se comportan
 * igual en móvil y en navegador, y este proyecto ya se llevó un rechazo de
 * Apple por un módulo nativo que no debía estar ahí.
 *
 * Cómo funciona el reparto del gesto con la lista que hay debajo: hasta que no
 * pasa `DELAY_MS` con el dedo quieto, este gestor NO reclama el toque, así que
 * la pantalla sigue desplazándose con normalidad. Solo cuando la pulsación es
 * claramente intencionada se toma el control y el elemento empieza a seguir al
 * dedo. Sin eso, arrastrar para leer movería cosas sin querer.
 */

/** Milisegundos manteniendo pulsado antes de que el elemento se "despegue". */
const DELAY_MS = 200;
/** Movimiento (px) que cancela la pulsación larga: es un desplazamiento. */
const CANCEL_PX = 8;

export interface DragReorder {
  /** Índice que se está arrastrando, o null. */
  draggingIndex: number | null;
  /** Posición donde caería ahora mismo. */
  targetIndex: number | null;
  /** Valor animado del elemento arrastrado (translateY). */
  pan: Animated.Value;
  /** Desplazamiento visual de un elemento que NO es el arrastrado. */
  shiftFor: (index: number) => number;
  /** ¿Es este el elemento que se está arrastrando? */
  isDragging: (index: number) => boolean;
  /** Handlers del gesto para el elemento en esa posición. */
  handlersFor: (index: number) => Partial<GestureResponderHandlers>;
  /** Mide el alto real de cada elemento (los hay de distinto tamaño). */
  onLayoutFor: (index: number) => (e: LayoutChangeEvent) => void;
}

export function useDragReorder(
  count: number,
  onReorder: (from: number, to: number) => void,
  enabled = true
): DragReorder {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const pan = useRef(new Animated.Value(0)).current;

  // Altos medidos de cada elemento. En una ref y no en estado: cambian al
  // pintar y no deben provocar otro pintado.
  const heights = useRef<number[]>([]);
  // Espejos en ref de lo que necesita el gesto: los callbacks del PanResponder
  // se crean una vez y no verían el estado actualizado.
  const fromRef = useRef<number | null>(null);
  const toRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activoRef = useRef(false);
  /**
   * Un PanResponder POR POSICIÓN, guardado y reutilizado.
   *
   * Crearlo en cada pintado parece inofensivo, pero rompe el gesto: al activarse
   * la pulsación larga se actualiza el estado, eso vuelve a pintar, y el
   * elemento recibe unos manejadores NUEVOS en mitad del arrastre. El sistema de
   * responders sigue apuntando a los viejos, así que el movimiento se pierde y
   * al soltar no se reordena nada.
   */
  const respondersRef = useRef(new Map<number, PanResponderInstance>());
  // Espejos de lo que cambia entre pintados y necesitan los manejadores fijos.
  const countRef = useRef(count);
  countRef.current = count;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  const onLayoutFor = useCallback(
    (index: number) => (e: LayoutChangeEvent) => {
      heights.current[index] = e.nativeEvent.layout.height;
    },
    []
  );

  const altoDe = useCallback(
    (i: number) => heights.current[i] ?? heights.current[0] ?? 56,
    []
  );

  /**
   * Posición de destino según lo que se lleva arrastrado.
   *
   * Se avanza vecino a vecino restando su alto: así funciona con elementos de
   * distinto tamaño (una tarjeta de curso no mide lo mismo que una fila de
   * tabla). Se cruza un vecino cuando se ha recorrido MÁS DE LA MITAD de su
   * alto, que es donde el ojo espera que el hueco cambie de sitio.
   */
  const calcularDestino = useCallback(
    (from: number, dy: number) => {
      let destino = from;
      let restante = dy;
      if (dy > 0) {
        while (destino < countRef.current - 1) {
          const h = altoDe(destino + 1);
          if (restante < h / 2) break;
          restante -= h;
          destino += 1;
        }
      } else {
        while (destino > 0) {
          const h = altoDe(destino - 1);
          if (-restante < h / 2) break;
          restante += h;
          destino -= 1;
        }
      }
      return destino;
    },
    [altoDe]
  );

  const cancelarTemporizador = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const terminar = useCallback(() => {
    cancelarTemporizador();
    const from = fromRef.current;
    const to = toRef.current;
    activoRef.current = false;
    fromRef.current = null;
    toRef.current = null;
    setDraggingIndex(null);
    setTargetIndex(null);
    pan.setValue(0);
    if (from !== null && to !== null && from !== to) onReorderRef.current(from, to);
  }, [pan]);

  const handlersFor = useCallback(
    (index: number) => {
      if (!enabled) return {};
      const guardado = respondersRef.current.get(index);
      if (guardado) return guardado.panHandlers;
      const responder = PanResponder.create({
        // No se reclama el toque de entrada: primero hay que mantenerlo.
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => {
          cancelarTemporizador();
          timerRef.current = setTimeout(() => {
            activoRef.current = true;
            fromRef.current = index;
            toRef.current = index;
            setDraggingIndex(index);
            setTargetIndex(index);
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            }
          }, DELAY_MS);
          return false;
        },
        // Solo se toma el control una vez la pulsación larga ha "prendido".
        onMoveShouldSetPanResponder: (_e, g) => {
          if (!activoRef.current) {
            // Se ha movido antes de tiempo: es un desplazamiento, no un arrastre.
            if (Math.abs(g.dy) > CANCEL_PX || Math.abs(g.dx) > CANCEL_PX) {
              cancelarTemporizador();
            }
            return false;
          }
          return true;
        },
        onPanResponderMove: (_e, g) => {
          if (!activoRef.current || fromRef.current === null) return;
          pan.setValue(g.dy);
          const destino = calcularDestino(fromRef.current, g.dy);
          if (destino !== toRef.current) {
            toRef.current = destino;
            setTargetIndex(destino);
          }
        },
        onPanResponderRelease: terminar,
        onPanResponderTerminate: terminar,
        onPanResponderTerminationRequest: () => !activoRef.current,
      });
      respondersRef.current.set(index, responder);
      return responder.panHandlers;
    },
    [enabled, calcularDestino, pan, terminar]
  );

  /**
   * Cuánto se aparta un elemento para dejar el hueco. Los que quedan entre el
   * origen y el destino se corren un puesto en sentido contrario al arrastre.
   */
  const shiftFor = useCallback(
    (index: number) => {
      const from = draggingIndex;
      const to = targetIndex;
      if (from === null || to === null || from === to || index === from) return 0;
      if (from < to && index > from && index <= to) return -altoDe(from);
      if (from > to && index < from && index >= to) return altoDe(from);
      return 0;
    },
    [draggingIndex, targetIndex, altoDe]
  );

  const isDragging = useCallback((index: number) => draggingIndex === index, [draggingIndex]);

  return useMemo(
    () => ({
      draggingIndex,
      targetIndex,
      pan,
      shiftFor,
      isDragging,
      handlersFor,
      onLayoutFor,
    }),
    [draggingIndex, targetIndex, pan, shiftFor, isDragging, handlersFor, onLayoutFor]
  );
}

/** Mueve un elemento de una posición a otra devolviendo una lista nueva. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const copia = [...list];
  const [x] = copia.splice(from, 1);
  copia.splice(to, 0, x);
  return copia;
}
