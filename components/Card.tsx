import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadows, spacing } from '../lib/theme';

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
  return <View style={[styles.card, accent && styles.accent, style]}>{children}</View>;
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
  accent: {
    borderColor: colors.hairline,
  },
});
