import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useLayout } from '../lib/responsive';
import { spacing } from '../lib/theme';

interface GridProps {
  children: React.ReactNode;
  /** Columnas fijas. Si no se indica, las decide el tamaño de pantalla. */
  columns?: number;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Rejilla de tarjetas: una columna en el móvil, varias en pantallas grandes.
 *
 * Se reparte en filas a mano en vez de usar `flexWrap` con anchos en
 * porcentaje: con separación entre elementos, un `width: 50%` se pasa del
 * contenedor y la rejilla se rompe justo en el tamaño en que debería lucir.
 * Repartiendo por filas, cada hueco es un `flex: 1` y las columnas salen
 * siempre iguales, con o sin separación.
 *
 * La última fila incompleta se rellena con huecos vacíos para que sus tarjetas
 * midan lo mismo que las de arriba y no se estiren.
 */
export function Grid({ children, columns, gap = spacing.md, style }: GridProps) {
  const layout = useLayout();
  const cols = Math.max(1, columns ?? layout.columns);
  const items = React.Children.toArray(children).filter(Boolean);

  if (cols === 1) {
    return <View style={[{ gap }, style]}>{items}</View>;
  }

  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols));

  return (
    <View style={[{ gap }, style]}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap, alignItems: 'stretch' }}>
          {row.map((child, c) => (
            <View key={c} style={{ flex: 1 }}>
              {child}
            </View>
          ))}
          {Array.from({ length: cols - row.length }).map((_, c) => (
            <View key={`hueco-${c}`} style={{ flex: 1 }} pointerEvents="none" />
          ))}
        </View>
      ))}
    </View>
  );
}
