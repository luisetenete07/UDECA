import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { t } from '../lib/idioma';
import { colors, fonts, radius, shadows, spacing } from '../lib/theme';

type Listener = (message: string) => void;
let listener: Listener | null = null;

/**
 * Aviso flotante dorado de confirmación ("Guardado", "Enviado"...).
 * Llama a showToast(mensaje) desde cualquier pantalla; el ToastHost montado
 * en el layout raíz lo muestra 2,2 s y desaparece solo.
 */
/**
 * Un aviso, ya en el idioma de quien lo lee.
 *
 * Se traduce AQUÍ y no en cada llamada porque hay más de cien `showToast` por
 * la app: envolverlos uno a uno significa que el próximo se escriba sin
 * envolver y salga en español para siempre sin que nadie lo note.
 *
 * Lo que no esté en el diccionario sale tal cual, así que un aviso que lleve
 * dentro el nombre de alguien nunca se estropea.
 */
export function showToast(message: string) {
  listener?.(t(message));
}

export function ToastHost() {
  const [message, setMessage] = useState<string | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listener = (msg: string) => {
      setMessage(msg);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      Animated.spring(anim, { toValue: 1, friction: 7, useNativeDriver: true }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() =>
          setMessage(null)
        );
      }, 2200);
    };
    return () => {
      listener = null;
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [anim]);

  if (!message) return null;

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View
        style={[
          styles.toast,
          {
            opacity: anim,
            transform: [
              {
                translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }),
              },
            ],
          },
        ]}
      >
        <Ionicons name="checkmark-circle" size={16} color={colors.onPrimary} />
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    ...shadows.card,
  },
  text: {
    color: colors.onPrimary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
});
