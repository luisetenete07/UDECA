import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * El récord, en el momento en que pasa.
 *
 * Hasta ahora los récords se descubrían al terminar la sesión, en la pantalla
 * de resumen. Pero el momento en que alguien hace una repetición más que en
 * toda su vida es EL momento, y ocurre con la barra todavía en la mano: dárselo
 * cinco ejercicios después es tirarlo.
 *
 * Es una banda y no una pantalla completa a propósito. A mitad de entreno, algo
 * que tapa lo que estás haciendo deja de ser una celebración y pasa a ser un
 * estorbo; la fiesta grande (el confeti) sigue estando al final, que es cuando
 * hay tiempo de mirarla.
 */
export function PRBurst({
  exerciseName,
  label,
  previous,
  onDone,
}: {
  exerciseName: string;
  label: string;
  /** Marca anterior, si la había. Sin ella no se enseña el "antes". */
  previous?: string | null;
  onDone: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const brillo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    const secuencia = Animated.sequence([
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 6, tension: 90 }),
      Animated.timing(brillo, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(1400),
      Animated.timing(anim, {
        toValue: 0,
        duration: 280,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    secuencia.start(({ finished }) => {
      if (finished) onDone();
    });
    return () => secuencia.stop();
    // Se monta una vez por récord: la clave del componente cambia con cada uno.
  }, [anim, brillo, onDone]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          opacity: anim,
          transform: [
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) },
          ],
        },
      ]}
    >
      <View style={styles.card}>
        <Animated.View
          style={[
            styles.halo,
            {
              opacity: brillo.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
              transform: [
                { scale: brillo.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.35] }) },
              ],
            },
          ]}
        />
        <View style={styles.icon}>
          <Ionicons name="trophy" size={19} color={colors.onPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Récord personal</Text>
          <Text style={styles.line} numberOfLines={1}>
            <Text style={styles.mark}>{label}</Text>
            {'  ·  '}
            {exerciseName}
          </Text>
          {previous ? <Text style={styles.prev}>Tu marca era {previous}</Text> : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    zIndex: 50,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    width: '100%',
    maxWidth: 460,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  halo: {
    position: 'absolute',
    top: -40,
    left: -40,
    right: -40,
    bottom: -40,
    backgroundColor: colors.primary,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.label,
    color: colors.primaryBright,
    textTransform: 'uppercase',
    fontSize: 11,
  },
  line: { ...typography.body, color: colors.text, marginTop: 1 },
  mark: { fontFamily: fonts.heading, color: colors.primaryBright },
  prev: { ...typography.small, color: colors.textFaint, fontSize: 12, marginTop: 1 },
});
