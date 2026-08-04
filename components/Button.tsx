import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
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
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  /**
   * El botón se hunde y vuelve con muelle, como todo lo que se toca desde el
   * rediseño (ver PressableScale). Antes cambiaba de escala de golpe: el salto
   * se ve como un parpadeo, no como una respuesta, y en el elemento que más se
   * pulsa de la app esa diferencia es la mitad de la sensación de calidad.
   */
  const scale = useRef(new Animated.Value(1)).current;
  const anima = (hacia: number, muelle: boolean) => {
    Animated.spring(scale, {
      toValue: hacia,
      useNativeDriver: true,
      friction: muelle ? 5 : 9,
      tension: muelle ? 140 : 220,
    }).start();
  };

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
    <Text style={[styles.text, variant === 'primary' && styles.textPrimary]}>{title}</Text>
  );

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => {
        if (!isDisabled) anima(0.97, false);
      }}
      onPressOut={() => anima(1, true)}
      disabled={isDisabled}
      role="button"
      style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [
        styles.outer,
        isDisabled && styles.disabled,
        hovered && !isDisabled && styles.hovered,
        style,
      ]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        {variant === 'primary' ? (
          // Acabado oro con degradado de marca y filo brillante superior.
          <LinearGradient
            colors={gradients.gold}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.base}
          >
            <View style={styles.sheen} />
            {inner}
          </LinearGradient>
        ) : (
          <View style={[styles.base, variantStyles[variant]]}>{inner}</View>
        )}
      </Animated.View>
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
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  hovered: {
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.5,
  },
  /**
   * Sin interletrado positivo. Lo pedía Cinzel, que iba en capitales; con Sora
   * e Inter, abrir las letras de un rótulo corto lo deja flojo. Se queda el de
   * `h3`, que ya es ligeramente negativo.
   */
  text: {
    ...typography.h3,
    color: colors.text,
  },
  textPrimary: {
    color: colors.onPrimary,
  },
});

const variantStyles: Record<Exclude<NonNullable<ButtonProps['variant']>, 'primary'>, ViewStyle> = {
  /**
   * Gris, no oro. El borde era dorado y lo convertía en un segundo botón de
   * marca: dos llamadas del mismo color en la misma pantalla y ninguna manda.
   * El oro se reserva para lo que se propone; lo demás acompaña.
   */
  secondary: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.dangerMuted, borderWidth: 1, borderColor: colors.danger },
};
