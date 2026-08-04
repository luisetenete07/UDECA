import React, { useRef } from 'react';
import { Animated, Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Todo lo que se toca, responde.
 *
 * Se hunde un poco al pulsar y vuelve con muelle al soltar. Parece un detalle
 * tonto y es de las cosas que más separan una app cara de una barata: sin
 * respuesta al tacto, cada pulsación deja medio segundo de duda —"¿lo he
 * pulsado?"— y esa duda es la que se recuerda como "va lenta", aunque los datos
 * lleguen igual de rápido.
 *
 * La escala es pequeña a propósito (0,97). Un botón que se encoge de verdad
 * parece un juguete; este solo confirma.
 */
export function PressableScale({
  children,
  style,
  haptic = false,
  scaleTo = 0.97,
  ...rest
}: PressableProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Vibración corta al pulsar. Para acciones, no para navegar. */
  haptic?: boolean;
  scaleTo?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const anima = (hacia: number, muelle: boolean) => {
    Animated.spring(scale, {
      toValue: hacia,
      useNativeDriver: true,
      friction: muelle ? 5 : 9,
      tension: muelle ? 140 : 220,
    }).start();
  };

  return (
    <Pressable
      onPressIn={(e) => {
        anima(scaleTo, false);
        if (haptic && Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        anima(1, true);
        rest.onPressOut?.(e);
      }}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
