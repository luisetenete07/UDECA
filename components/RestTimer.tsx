import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { playBeep, primeAudio } from '../lib/sound';
import { cancelRestEndNotification, scheduleRestEndNotification } from '../lib/notifications';
import { alargarDescanso, restantes, stopRestSiEs, type ActiveRest } from '../lib/restTimerStore';
import { showToast } from './Toast';
import { colors, fonts, radius, shadows, spacing, typography } from '../lib/theme';

interface RestTimerProps {
  /** El descanso que corre (lib/restTimerStore.ts): su final y su duración. */
  rest: ActiveRest;
  /**
   * Dentro de la pantalla de entreno, debajo de las series, en vez de flotar
   * encima de todo. Flotando tapaba "Anterior" y "Siguiente".
   */
  enLinea?: boolean;
}

/** El último descanso que ya avisó: avisa una vez aunque se monte dos veces. */
let yaAviso = 0;

/**
 * Cronómetro de descanso entre series. Aparece al completar una serie, cuenta
 * atrás con su barra y avisa (háptica o pitido) al terminar.
 *
 * La hora a la que acaba vive en el estado global, no aquí: así cuenta igual
 * dentro de la pantalla de entreno y flotando en las demás pestañas, y no
 * vuelve a empezar al pasar de una a otra.
 */
export function RestTimer({ rest, enLinea = false }: RestTimerProps) {
  const [remaining, setRemaining] = useState(() => restantes(rest));
  const restRef = useRef(rest);
  restRef.current = rest;
  const barAnim = useRef(new Animated.Value(rest.seconds > 0 ? restantes(rest) / rest.seconds : 0)).current;

  // Cierra el descanso una sola vez: avisa (háptica/sonido) y lo para.
  const finish = () => {
    const r = restRef.current;
    if (yaAviso === r.id) return;
    yaAviso = r.id;
    cancelRestEndNotification();
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      playBeep();
    }
    // Aviso rápido en pantalla: se cierra solo en ~2 s.
    showToast('Descanso terminado · a por la siguiente serie');
    setTimeout(() => stopRestSiEs(r.id), 600);
  };

  // Barra fluida: acompaña la cuenta atrás sin saltos por segundo.
  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: rest.seconds > 0 ? Math.max(remaining - 1, 0) / rest.seconds : 0,
      duration: 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [remaining, rest.seconds, barAnim]);

  // El timer aparece tras un gesto (marcar serie): se prepara el audio para
  // poder sonar al terminar (política de autoplay web) y se programa una
  // notificación local que suena aunque la pantalla esté apagada. Con cada
  // cambio del final ("+15 s") se vuelve a programar.
  useEffect(() => {
    primeAudio();
    const rem = restantes(rest);
    if (rem > 0) scheduleRestEndNotification(rem);
  }, [rest.id, rest.endsAt]);

  useEffect(() => {
    const tick = () => {
      const rem = restantes(restRef.current);
      setRemaining((prev) => (prev === rem ? prev : rem));
      if (rem <= 0) finish();
    };
    tick();
    // Ticks frecuentes para reengancharse rápido al volver de segundo plano.
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [rest.id]);

  // Al volver a primer plano (desbloquear el móvil o reabrir la pestaña), se
  // recalcula lo que queda contra el reloj real de inmediato.
  useEffect(() => {
    const resync = () => {
      const rem = restantes(restRef.current);
      setRemaining(rem);
      if (rem <= 0) finish();
    };
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return;
      const onVis = () => {
        if (document.visibilityState === 'visible') resync();
      };
      document.addEventListener('visibilitychange', onVis);
      window.addEventListener('focus', resync);
      return () => {
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('focus', resync);
      };
    }
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') resync();
    });
    return () => sub.remove();
  }, []);

  const handleSkip = () => {
    cancelRestEndNotification();
    stopRestSiEs(rest.id);
  };

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <View style={[styles.container, enLinea && styles.containerEnLinea]}>
      <View style={styles.topRow}>
        <View style={styles.labelWrap}>
          <View style={styles.labelRow}>
            <Ionicons name="hourglass-outline" size={15} color={colors.primary} />
            <Text style={styles.label}>Descanso</Text>
          </View>
          {rest.title ? <Text style={styles.title} numberOfLines={1}>{rest.title}</Text> : null}
        </View>
        <Text style={[styles.time, enLinea && styles.timeEnLinea]}>
          {mins}:{secs.toString().padStart(2, '0')}
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: barAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['2%', '100%'],
              }),
            },
          ]}
        />
      </View>
      <View style={styles.actionsRow}>
        {/* Dos botones: un poco más de descanso, o seguir ya. Había también
            "−15 s", pero acortar es lo mismo que saltar un poco antes: un
            botón más que pensar entre serie y serie. */}
        <Pressable onPress={() => alargarDescanso(15)} style={styles.action} hitSlop={8}>
          <Ionicons name="add" size={14} color={colors.text} />
          <Text style={styles.actionText}>15s</Text>
        </Pressable>
        <Pressable onPress={handleSkip} style={[styles.action, styles.actionSkip]} hitSlop={8}>
          <Text style={[styles.actionText, styles.actionSkipText]}>Seguir</Text>
          <Ionicons name="play-skip-forward" size={13} color={colors.onPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    ...shadows.brillo,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  labelWrap: { flex: 1, gap: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  label: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.small,
    color: colors.text,
    fontFamily: fonts.semiBold,
  },
  // Dentro de la tarjeta: sin la sombra que lo hacía flotar, y separado de
  // las series de arriba.
  containerEnLinea: { marginTop: spacing.sm, marginBottom: 0, shadowOpacity: 0, elevation: 0, borderColor: colors.primary },
  timeEnLinea: { fontSize: 34, lineHeight: 38 },
  time: {
    fontSize: 40,
    lineHeight: 44,
    color: colors.primaryBright,
    fontFamily: fonts.heading,
    fontVariant: ['tabular-nums'],
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionSkip: {
    marginLeft: 'auto',
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    gap: 5,
  },
  actionText: {
    ...typography.small,
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  actionSkipText: { color: colors.onPrimary },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
});
