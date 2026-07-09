import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';

const NATIVE = Platform.OS !== 'web';

/**
 * Animación breve de bienvenida al abrir la app: el logo de UDECA aparece
 * con un destello dorado, se asienta y todo se desvanece hacia la app.
 * Se muestra una vez por arranque. Llama a `onFinish` al terminar.
 */
export function AnimatedSplash({ onFinish }: { onFinish: () => void }) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const container = useRef(new Animated.Value(1)).current;
  const done = useRef(onFinish);
  done.current = onFinish;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 480,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: NATIVE,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 55,
          useNativeDriver: NATIVE,
        }),
      ]),
      Animated.delay(520),
      Animated.parallel([
        Animated.timing(container, {
          toValue: 0,
          duration: 420,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: NATIVE,
        }),
        Animated.timing(logoScale, {
          toValue: 1.12,
          duration: 420,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: NATIVE,
        }),
      ]),
    ]).start(() => done.current());
  }, [container, logoOpacity, logoScale]);

  return (
    <Animated.View style={[styles.container, { opacity: container }]} pointerEvents="none">
      <Animated.View
        style={[styles.logoWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
      >
        <Animated.Image
          source={require('../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  logoWrap: {
    borderRadius: 30,
    // Halo dorado suave (se difumina en web/iOS; en Android queda plano).
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 48,
    elevation: 24,
  },
  logo: {
    width: 140,
    height: 140,
    borderRadius: 32,
  },
});
