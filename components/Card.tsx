import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadows, spacing, surfaceHighlight } from '../lib/theme';

export function Card({
  children,
  style,
  accent,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Tarjeta destacada: filo dorado sutil en lugar del borde neutro. */
  accent?: boolean;
}) {
  return (
    <View style={[styles.card, accent && styles.accent, style]}>
      {/* Filo de luz superior: da la sensación de material iluminado desde
          arriba en vez de un rectángulo plano. Va detrás del contenido y no
          intercepta toques. */}
      <View style={styles.highlight} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    // Más aire dentro: la tarjeta respira y el contenido deja de tocar el
    // borde. Es lo que separa una tarjeta cara de un rectángulo con datos.
    padding: spacing.lg - 2,
    ...shadows.card,
  },
  highlight: surfaceHighlight,
  accent: {
    borderColor: colors.hairline,
  },
});
