import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { colors, spacing, typography } from '../lib/theme';

/**
 * Pantalla de carga con identidad propia: el logo de UDECA late suavemente
 * mientras llegan los datos (en vez de un spinner genérico).
 */
export function LoadingScreen({ label }: { label?: string }) {
  const pulse = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.04,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.9,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require('../assets/icon.png')}
        style={[styles.logo, { transform: [{ scale: pulse }] }]}
        resizeMode="contain"
      />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 20,
  },
  label: {
    ...typography.body,
    color: colors.textMuted,
  },
});
