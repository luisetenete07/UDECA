import React from 'react';
import {
  Animated,
  StyleSheet,
  View,
  type GestureResponderHandlers,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useDragReorder } from '../lib/useDragReorder';
import { shadows, spacing } from '../lib/theme';

interface DragListProps<T> {
  items: T[];
  keyOf: (item: T, index: number) => string;
  /**
   * `dragging` resalta el elemento mientras se mueve. `handleProps` son los
   * gestos del arrastre: hay que colocarlos en el asa cuando `handleOnly`.
   */
  renderItem: (
    item: T,
    index: number,
    dragging: boolean,
    handleProps: Partial<GestureResponderHandlers>
  ) => React.ReactNode;
  onReorder: (from: number, to: number) => void;
  /** Separación entre elementos. */
  gap?: number;
  /** Desactiva el arrastre (p. ej. cuando solo se puede mirar). */
  disabled?: boolean;
  /**
   * El arrastre sale solo del asa, no de toda la fila.
   *
   * Hace falta en cuanto la fila tiene algo más que pulsar: si toda la tarjeta
   * de un curso arrastra, mantener el dedo un instante de más al abrirlo la
   * levanta; y en una fila con campos de texto, colocar el cursor la movería.
   */
  handleOnly?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Lista que se reordena arrastrando: se mantiene pulsado un elemento y se
 * mueve arriba o abajo.
 *
 * Toda la app usaba flechas de subir/bajar de uno en uno. Para bajar un
 * ejercicio cinco puestos eran cinco toques, cada uno con su repintado, y sin
 * ver dónde va a caer hasta que llega. Arrastrar es un solo gesto y se ve el
 * hueco abrirse mientras se mueve.
 *
 * El elemento arrastrado se levanta con sombra y los demás se apartan para
 * dejar sitio, así que la posición final se ve ANTES de soltar.
 */
export function DragList<T>({
  items,
  keyOf,
  renderItem,
  onReorder,
  gap = spacing.sm,
  disabled = false,
  handleOnly = false,
  style,
}: DragListProps<T>) {
  const drag = useDragReorder(items.length, onReorder, !disabled);

  return (
    <View style={style}>
      {items.map((item, index) => {
        const arrastrando = drag.isDragging(index);
        const gestos = drag.handlersFor(index);
        return (
          <Animated.View
            key={keyOf(item, index)}
            onLayout={drag.onLayoutFor(index)}
            {...(handleOnly ? {} : gestos)}
            style={[
              styles.row,
              { marginBottom: index === items.length - 1 ? 0 : gap },
              arrastrando
                ? // El que se arrastra va por encima de todo y sigue al dedo.
                  { transform: [{ translateY: drag.pan }], zIndex: 10, ...shadows.card }
                : { transform: [{ translateY: drag.shiftFor(index) }] },
              arrastrando && styles.lifted,
            ]}
          >
            {renderItem(item, index, arrastrando, handleOnly ? gestos : {})}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  lifted: { opacity: 0.95 },
  // Arrastrar no debe seleccionar el texto de la fila (pasa en navegador).
  row: { userSelect: 'none' },
});
