import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadows, spacing, surfaceHighlight } from '../lib/theme';

interface CardButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  /** Tarjeta destacada: filo dorado en lugar del borde neutro. */
  accent?: boolean;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

/**
 * Tarjeta que se puede pulsar, con los estados que se esperan de un producto
 * cuidado: reposo, cursor encima y pulsada.
 *
 * Existe porque hasta ahora las listas eran `<Pressable><Card>…</Card></Pressable>`
 * sin ninguna respuesta visual: en el ordenador no había forma de saber que una
 * fila era pulsable hasta hacer clic, y en el móvil no se notaba el toque. Es de
 * las cosas que no se saben nombrar cuando faltan, pero que separan una app que
 * parece terminada de una que no.
 *
 * Al pasar el cursor se aclara la superficie y el borde en vez de mover la
 * tarjeta: un desplazamiento haría "saltar" las filas de una lista larga.
 */
export function CardButton({ children, onPress, accent, style, disabled }: CardButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      role="button"
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.card,
        accent && styles.accent,
        hovered && !disabled && styles.hovered,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.highlight} pointerEvents="none" />
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.card,
  },
  highlight: surfaceHighlight,
  accent: { borderColor: colors.hairline },
  hovered: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.hairline,
  },
  pressed: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.hairline,
    opacity: 0.92,
  },
  disabled: { opacity: 0.5 },
});
