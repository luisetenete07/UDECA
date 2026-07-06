import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, fonts, radius, shadows, spacing, typography } from '../lib/theme';

interface RestTimerProps {
  /** Segundos de descanso. Cambiar la key del componente reinicia el timer. */
  seconds: number;
  onDone: () => void;
}

/**
 * Cronómetro de descanso entre series. Aparece al completar una serie,
 * cuenta atrás con barra de progreso dorada y avisa (háptica) al terminar.
 */
export function RestTimer({ seconds, onDone }: RestTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const total = useRef(seconds);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          // Da tiempo a ver el 0 antes de cerrarse.
          setTimeout(() => doneRef.current(), 600);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const addTime = (extra: number) => {
    total.current += extra;
    setRemaining((r) => r + extra);
  };

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress = total.current > 0 ? remaining / total.current : 0;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Ionicons name="hourglass-outline" size={16} color={colors.primary} />
        <Text style={styles.label}>Descanso</Text>
        <Text style={styles.time}>
          {mins}:{secs.toString().padStart(2, '0')}
        </Text>
        <Pressable onPress={() => addTime(30)} style={styles.action} hitSlop={8}>
          <Text style={styles.actionText}>+30s</Text>
        </Pressable>
        <Pressable onPress={() => doneRef.current()} style={styles.action} hitSlop={8}>
          <Text style={styles.actionText}>Saltar</Text>
        </Pressable>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(progress * 100, 2)}%` }]} />
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  time: {
    ...typography.h2,
    color: colors.primaryBright,
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.heading,
  },
  action: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionText: {
    ...typography.small,
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
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
