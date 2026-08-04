import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { playBeep, primeAudio } from '../lib/sound';
import { cancelRestEndNotification, scheduleRestEndNotification } from '../lib/notifications';
import { showToast } from './Toast';
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
    // Aviso rápido en pantalla: se cierra solo en ~2 s (se desvanece al seguir
    // con la siguiente serie sin estorbar).
    showToast('Descanso terminado · a por la siguiente serie');
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

  // Suma o RESTA tiempo al descanso; si al restar llega a cero, termina.
  const addTime = (extra: number) => {
    total.current = Math.max(1, total.current + extra);
    endsAt.current = Math.max(Date.now(), endsAt.current + extra * 1000);
    firedRef.current = false;
    const rem = remainingNow();
    setRemaining(rem);
    if (rem <= 0) {
      finish();
    } else {
      scheduleRestEndNotification(rem);
    }
  };

  const handleSkip = () => {
    cancelRestEndNotification();
    doneRef.current();
  };

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  /**
   * Los últimos diez segundos se avisan por color, no por texto.
   *
   * El descanso no termina cuando suena: termina cuando estás colocado. Diez
   * segundos es lo que se tarda en levantarse, secarse las manos y ponerse bajo
   * la barra, y hasta ahora nada lo decía — el número seguía igual de dorado a
   * 1:30 que a 0:04. En ámbar es la misma información que da un semáforo: sin
   * leer, y a un metro de distancia.
   */
  const casiListo = remaining <= 10;
  const colorCuenta = casiListo ? colors.warning : colors.primaryBright;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {/* El número manda. Estaba a la derecha, compartiendo fila con dos
            líneas de texto que se llevaban todo el ancho flexible; en un
            componente cuyo único trabajo es decir cuánto queda, la cuenta es el
            contenido y lo demás es la etiqueta. */}
        <Text style={[styles.time, { color: colorCuenta }]}>
          {mins}:{secs.toString().padStart(2, '0')}
        </Text>
        <View style={styles.labelWrap}>
          <View style={styles.labelRow}>
            <Ionicons
              name={casiListo ? 'flash' : 'hourglass-outline'}
              size={14}
              color={casiListo ? colors.warning : colors.primary}
            />
            <Text style={[styles.label, casiListo && styles.labelReady]}>
              {casiListo ? 'Prepárate' : 'Descanso'}
            </Text>
          </View>
          {title ? (
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            casiListo && styles.fillReady,
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
        {/* "−15" y "+15", no un icono diminuto junto a dos "15s" idénticos:
            eran el mismo botón dos veces salvo por un signo de 14 px. */}
        <Pressable onPress={() => addTime(-15)} style={styles.action} hitSlop={8}>
          <Text style={styles.actionText}>−15</Text>
        </Pressable>
        <Pressable onPress={() => addTime(15)} style={styles.action} hitSlop={8}>
          <Text style={styles.actionText}>+15</Text>
        </Pressable>
        <Pressable onPress={handleSkip} style={[styles.action, styles.actionSkip]} hitSlop={8}>
          <Text style={[styles.actionText, styles.actionSkipText]}>Saltar</Text>
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
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  labelWrap: { flex: 1, gap: 2, minWidth: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  label: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  labelReady: { color: colors.warning },
  title: {
    ...typography.small,
    color: colors.text,
    fontFamily: fonts.semiBold,
    lineHeight: 17,
  },
  /**
   * La cuenta atrás, a tamaño de cuenta atrás: se mira desde el banco, con el
   * móvil en el suelo y a un metro. Va en la display (Sora) y con el
   * interletrado apretado del rediseño, no en la de texto.
   */
  time: {
    fontSize: 52,
    lineHeight: 56,
    letterSpacing: -2,
    fontFamily: fonts.display,
    // Imprescindible aquí: los dígitos de Sora son de ancho proporcional (su
    // "1" mide poco más de la mitad que su "0"), así que sin cifras tabulares
    // la cuenta atrás daría un salto lateral en cada segundo.
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
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  actionSkipText: { color: colors.onPrimary },
  track: {
    // De 4 a 6 px: es la única pista de "cuánto queda" que se ve de reojo sin
    // llegar a leer el número.
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  fillReady: { backgroundColor: colors.warning },
});
