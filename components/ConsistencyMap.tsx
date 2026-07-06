import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { startOfWeek } from '../lib/stats';
import { colors, fonts, spacing } from '../lib/theme';
import { WEEKDAY_LABELS } from '../lib/types';

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Mapa de constancia: cuadrícula de las últimas `weeks` semanas (columnas)
 * por día de la semana (filas). Punto dorado = día entrenado. El clásico
 * "calendario de contribuciones" aplicado al entrenamiento.
 */
export function ConsistencyMap({
  days,
  weeks = 12,
}: {
  /** Días entrenados como timestamps a medianoche (ver trainingDays). */
  days: Set<number>;
  weeks?: number;
}) {
  const currentWeekStart = startOfWeek(Date.now());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTs = today.getTime();

  const weekStarts = Array.from(
    { length: weeks },
    (_, i) => currentWeekStart - (weeks - 1 - i) * DAY_MS * 7
  );

  return (
    <View style={styles.wrap}>
      <View>
        {WEEKDAY_LABELS.map((label, row) => (
          <View key={label} style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            {weekStarts.map((ws) => {
              const dayTs = ws + row * DAY_MS;
              const trained = days.has(dayTs);
              const isFuture = dayTs > todayTs;
              const isToday = dayTs === todayTs;
              return (
                <View
                  key={ws}
                  style={[
                    styles.cell,
                    trained && styles.cellTrained,
                    isFuture && styles.cellFuture,
                    isToday && styles.cellToday,
                  ]}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  rowLabel: {
    width: 18,
    fontSize: 9,
    fontFamily: fonts.medium,
    color: colors.textFaint,
  },
  cell: {
    width: 14,
    height: 14,
    borderRadius: 4,
    marginRight: 4,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cellTrained: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  cellFuture: { opacity: 0.25 },
  cellToday: { borderColor: colors.primaryBright, borderWidth: 1.5 },
});
