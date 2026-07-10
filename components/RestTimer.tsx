import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { playBeep, primeAudio } from '../lib/sound';
import { cancelRestEndNotification, scheduleRestEndNotification } from '../lib/notifications';
import { colors, fonts, radius, shadows, spacing, typography } from '../lib/theme';

interface RestTimerProps {
  /** Segundos de descanso. Cambiar la key del componente reinicia el timer. */
  seconds: number;
  /** Texto de "lo siguiente" (p. ej. "Ahora: Serie 2 · Dominadas"). */
  title?: string;
  onDone: () => void;
}

/**
 * Cronómetro de descanso entre series. Aparece al completar una serie,
 * cuenta atrás con barra de progreso dorada y avisa (háptica) al terminar.
 */
export function RestTimer({ seconds, title, onDone }: RestTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const total = useRef(seconds);
  // Momento absoluto en que termina el descanso. Al calcular el tiempo restante
  // contra el reloj (Date.now) en vez de restar 1 cada segundo, la cuenta atrás
  // sigue siendo exacta aunque el móvil se bloquee o la app pase a segundo plano.
  const endsAt = useRef(Date.now() + seconds * 1000);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const firedRef = useRef(false);
  const barAnim = useRef(new Animated.Value(1)).current;

  const remainingNow = () => Math.max(0, Math.round((endsAt.current - Date.now()) / 1000));

  // Cierra el descanso una sola vez: avisa (háptica/sonido) y llama a onDone.
  const finish = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    cancelRestEndNotification();
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      playBeep();
    }
    setTimeout(() => doneRef.current(), 600);
  };

  // Barra fluida: acompaña la cuenta atrás sin saltos por segundo.
  useEffect(() => {
    Animated.timing(barAnim, {
      toValue: total.current > 0 ? Math.max(remaining - 1, 0) / total.current : 0,
      duration: 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [remaining, barAnim]);

  // El timer aparece tras un gesto (marcar serie): preparamos el audio aquí
  // para poder sonar al terminar la cuenta atrás (política de autoplay web) y
  // programamos una notificación local que suena aunque la pantalla esté apagada.
  useEffect(() => {
    primeAudio();
    scheduleRestEndNotification(seconds);
    return () => {
      cancelRestEndNotification();
    };
  }, [seconds]);

  useEffect(() => {
    const tick = () => {
      const rem = remainingNow();
      setRemaining((prev) => (prev === rem ? prev : rem));
      if (rem <= 0) finish();
    };
    tick();
    // Ticks frecuentes para reengancharse rápido al volver de segundo plano.
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, []);

  // Al volver a primer plano (desbloquear el móvil o reabrir la pestaña),
  // recalculamos el tiempo restante contra el reloj real de inmediato.
  useEffect(() => {
    const resync = () => {
      const rem = remainingNow();
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

  const addTime = (extra: number) => {
    total.current += extra;
    endsAt.current += extra * 1000;
    firedRef.current = false;
    setRemaining(remainingNow());
    scheduleRestEndNotification(remainingNow());
  };

  const handleSkip = () => {
    cancelRestEndNotification();
    doneRef.current();
  };

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.labelWrap}>
          <View style={styles.labelRow}>
            <Ionicons name="hourglass-outline" size={15} color={colors.primary} />
            <Text style={styles.label}>Descanso</Text>
          </View>
          {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}
        </View>
        <Text style={styles.time}>
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
        <Pressable onPress={() => addTime(15)} style={styles.action} hitSlop={8}>
          <Ionicons name="add" size={14} color={colors.text} />
          <Text style={styles.actionText}>15s</Text>
        </Pressable>
        <Pressable onPress={() => addTime(30)} style={styles.action} hitSlop={8}>
          <Ionicons name="add" size={14} color={colors.text} />
          <Text style={styles.actionText}>30s</Text>
        </Pressable>
        <Pressable onPress={handleSkip} style={[styles.action, styles.actionSkip]} hitSlop={8}>
          <Text style={[styles.actionText, styles.actionSkipText]}>Saltar descanso</Text>
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
    ...shadows.glowGold,
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
