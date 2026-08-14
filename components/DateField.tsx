import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { fechaLegible, inicioDelDia } from '../lib/fechas';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Hoy a las 00:00. Lo usan los paneles que arrancan en la fecha de hoy. */
export function startOfToday(): number {
  return inicioDelDia(Date.now());
}

const two = (n: number) => String(n).padStart(2, '0');

/** yyyy-mm-dd local para el <input type="date"> de la web. */
function toISO(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

function fromISO(value: string): number | null {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return inicioDelDia(new Date(y, m - 1, d));
}

/**
 * Selector de fecha que funciona igual en web y en móvil: en web el calendario
 * nativo del navegador, en móvil flechas de día y de semana (sin dependencias
 * ni módulos nativos que luego haya que compilar).
 */
export function DateField({
  value,
  onChange,
  showToday = true,
}: {
  value: number;
  onChange: (ts: number) => void;
  showToday?: boolean;
}) {
  const shift = (dias: number) => onChange(value + dias * DAY_MS);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.webRow}>
        {React.createElement('input', {
          type: 'date',
          value: toISO(value),
          onChange: (e: { target: { value: string } }) => {
            const ts = fromISO(e.target.value);
            if (ts != null) onChange(ts);
          },
          style: {
            flex: 1,
            colorScheme: 'dark',
            background: colors.surfaceAlt,
            color: colors.text,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            padding: '13px 14px',
            fontSize: 15,
            fontFamily: 'inherit',
            minHeight: 52,
          },
        })}
        {showToday ? (
          <Pressable onPress={() => onChange(startOfToday())} style={styles.todayBtn} hitSlop={6}>
            <Text style={styles.todayText}>Hoy</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <>
      <View style={styles.row}>
        <Pressable onPress={() => shift(-7)} style={styles.stepBtn} hitSlop={6}>
          <Ionicons name="play-back" size={15} color={colors.primary} />
        </Pressable>
        <Pressable onPress={() => shift(-1)} style={styles.stepBtn} hitSlop={6}>
          <Ionicons name="chevron-back" size={18} color={colors.primary} />
        </Pressable>
        <Text style={styles.dateText}>{fechaLegible(value)}</Text>
        <Pressable onPress={() => shift(1)} style={styles.stepBtn} hitSlop={6}>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>
        <Pressable onPress={() => shift(7)} style={styles.stepBtn} hitSlop={6}>
          <Ionicons name="play-forward" size={15} color={colors.primary} />
        </Pressable>
      </View>
      {showToday ? (
        <Pressable onPress={() => onChange(startOfToday())} style={styles.todayInline} hitSlop={6}>
          <Text style={styles.todayText}>Hoy</Text>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  webRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    ...typography.body,
    color: colors.text,
    fontFamily: fonts.semiBold,
    minWidth: 120,
    textAlign: 'center',
  },
  todayBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  todayInline: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  todayText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
});
