import { inicioDeLaSemana, inicioDelDia, masDias } from '../lib/fechas';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Texto';

import { colors, fonts, spacing } from '../lib/theme';
import { WEEKDAY_LABELS } from '../lib/types';

/**
 * Mapa de constancia: cuadrícula de semanas (columnas) por día de la semana
 * (filas). Punto dorado = día entrenado. El clásico "calendario de
 * contribuciones" aplicado al entrenamiento.
 *
 * El periodo se lo dice quien lo usa (`desde`), que normalmente es el bloque
 * en curso: ver lib/constancia.ts. Antes eran doce semanas fijas, y quedaba
 * pegado a un reparto que hablaba de seis: dos periodos distintos en la misma
 * pantalla que nadie compara mentalmente.
 */
export function ConsistencyMap({
  days,
  weeks = 12,
  desde,
}: {
  /** Días entrenados como timestamps a medianoche (ver trainingDays). */
  days: Set<number>;
  weeks?: number;
  /** Lunes de la primera semana. Sin él, las `weeks` últimas hasta hoy. */
  desde?: number;
}) {
  const todayTs = inicioDelDia(Date.now());
  const primera = desde ?? masDias(inicioDeLaSemana(Date.now()), -7 * (weeks - 1));

  const weekStarts = Array.from({ length: weeks }, (_, i) => masDias(primera, 7 * i));

  return (
    <View style={styles.wrap}>
      <View>
        {WEEKDAY_LABELS.map((label, row) => (
          <View key={label} style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            {weekStarts.map((ws) => {
              const dayTs = masDias(ws, row);
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
