import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/** 0 = no le quedaba ninguna (al fallo). 4 significa "4 o más". */
const OPCIONES = [0, 1, 2, 3, 4];

const ETIQUETA: Record<number, string> = { 0: 'Fallo', 4: '4+' };

/**
 * Cuántas repeticiones quedaron en recámara (RIR) al terminar el ejercicio.
 *
 * Una sola pregunta por ejercicio y de un toque. Por serie sería más exacto,
 * pero cada pregunta en mitad de una serie se paga en abandono, y el RIR por
 * ejercicio es el que un entrenador usa de verdad.
 *
 * Se puede desmarcar volviendo a pulsar: un dato que no se puede quitar cuando
 * te has equivocado es un dato que la gente deja de meter.
 */
export function RirPicker({
  value,
  onChange,
}: {
  value?: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>¿Cuántas te quedaban?</Text>
      <View style={styles.row}>
        {OPCIONES.map((n) => {
          const activo = value === n;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              style={[styles.chip, activo && styles.chipActive, n === 0 && styles.chipFail]}
              hitSlop={4}
              accessibilityRole="radio"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={
                n === 0 ? 'Al fallo' : `Me quedaban ${n === 4 ? '4 o más' : n}`
              }
            >
              <Text style={[styles.chipText, activo && styles.chipTextActive]}>
                {ETIQUETA[n] ?? n}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm, gap: spacing.xs },
  label: { ...typography.small, color: colors.textMuted, fontSize: 12 },
  row: { flexDirection: 'row', gap: spacing.xs },
  chip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  chipFail: { borderColor: colors.hairlineFaint },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  chipText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold, fontSize: 12 },
  chipTextActive: { color: colors.primaryBright },
});
