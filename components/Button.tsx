import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './Texto';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius, spacing, typography } from '../lib/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * Menos margen a los lados, para botones que van VARIOS EN UNA FILA.
   *
   * El relleno de siempre (24 a cada lado) está pensado para un botón que se
   * lee solo y ocupa el ancho. Metidos tres en una fila de móvil, esos 48
   * píxeles salen del texto: al botón le quedan sesenta y pocos para una
   * palabra que mide ochenta, y la palabra se corta.
   */
  compacto?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
  compacto,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(
        variant === 'danger'
          ? Haptics.ImpactFeedbackStyle.Heavy
          : Haptics.ImpactFeedbackStyle.Light
      );
    }
    onPress();
  };

  const inner = loading ? (
    <ActivityIndicator color={variant === 'primary' ? colors.onPrimary : colors.text} />
  ) : (
    /*
     * Una línea, y sin partir palabras.
     *
     * Sin esto, un botón más estrecho que su texto no encoge la letra ni pone
     * puntos suspensivos: parte la palabra por donde le cabe. "Borrador" salía
     * como "Borrado" y una "r" suelta en la línea de abajo, que no se lee como
     * un texto largo sino como una app rota.
     *
     * Quien de verdad no quepa se corta con puntos suspensivos, que al menos
     * se entiende. Y para que no llegue a pasar, los botones que van en fila
     * llevan un ancho mínimo y la fila se parte en dos.
     */
    <Text
      style={[styles.text, variant === 'primary' && styles.textPrimary]}
      numberOfLines={1}
    >
      {title}
    </Text>
  );

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      role="button"
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.outer,
        isDisabled && styles.disabled,
        hovered && !isDisabled && styles.hovered,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {variant === 'primary' ? (
        // Acabado oro con degradado de marca y filo brillante superior.
        <LinearGradient
          colors={gradients.gold}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.base, compacto && styles.baseCompacta]}
        >
          <View style={styles.sheen} />
          {inner}
        </LinearGradient>
      ) : (
        <View style={[styles.base, compacto && styles.baseCompacta, variantStyles[variant]]}>{inner}</View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  base: {
    minHeight: 52,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  baseCompacta: { paddingHorizontal: spacing.sm },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  hovered: {
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    ...typography.h3,
    color: colors.text,
    letterSpacing: 0.3,
  },
  textPrimary: {
    color: colors.onPrimary,
  },
});

const variantStyles: Record<Exclude<NonNullable<ButtonProps['variant']>, 'primary'>, ViewStyle> = {
  secondary: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.hairline },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.dangerMuted, borderWidth: 1, borderColor: colors.danger },
};
