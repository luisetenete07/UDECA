import { inicioDeLaSemana, masDias } from '../lib/fechas';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, fonts, spacing, typography } from '../lib/theme';
import { todayWeekday, WEEKDAY_LABELS, type Routine } from '../lib/types';

/**
 * Tira de la semana en curso (L-D): punto dorado = día ya entrenado,
 * borde dorado = sesión planificada pendiente, anillo = hoy.
 */
export function WeekStrip({
  routine,
  trainedDays,
}: {
  routine: Routine | null;
  trainedDays: Set<number>;
}) {
  const weekStart = inicioDeLaSemana(Date.now());
  const today = todayWeekday();
  const plannedWeekdays = new Set(
    (routine?.days ?? []).map((d) => d.weekday).filter((w): w is number => w !== undefined)
  );

  return (
    <View style={styles.row}>
      {WEEKDAY_LABELS.map((label, i) => {
        const dayTs = masDias(weekStart, i);
        const trained = trainedDays.has(dayTs);
        const planned = plannedWeekdays.has(i);
        const isToday = i === today;
        return (
          <View key={label} style={styles.dayWrap}>
            <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{label}</Text>
            <View
              style={[
                styles.dot,
                planned && styles.dotPlanned,
                trained && styles.dotTrained,
                isToday && styles.dotToday,
              ]}
            >
              {trained ? (
                <Ionicons name="checkmark" size={13} color={colors.onPrimary} />
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  dayWrap: { alignItems: 'center', gap: 4 },
  dayLabel: { ...typography.small, fontSize: 11, color: colors.textFaint, fontFamily: fonts.medium },
  dayLabelToday: { color: colors.primaryBright, fontFamily: fonts.semiBold },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPlanned: { borderColor: colors.hairline },
  dotTrained: { backgroundColor: colors.primary, borderColor: colors.primary },
  dotToday: { borderWidth: 2, borderColor: colors.primaryBright },
});
