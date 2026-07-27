import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ClientReport } from '../lib/report';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * El informe de progreso PINTADO DENTRO DE LA APP: las mismas cifras que se
 * exportan a PDF, pero consultables al momento y sin salir. La tabla mensual
 * se desplaza en horizontal para que en el móvil no se aplasten las columnas.
 */

const COLS: { key: keyof ClientReport['months'][number]; label: string; width: number }[] = [
  { key: 'label', label: 'Mes', width: 128 },
  { key: 'sessions', label: 'Sesiones', width: 78 },
  { key: 'sets', label: 'Series', width: 68 },
  { key: 'reps', label: 'Reps', width: 68 },
  { key: 'seconds', label: 'Isom.', width: 68 },
  { key: 'volumeKg', label: 'Volumen', width: 92 },
];

function Tile({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function MarkRow({ label, mark, unit }: { label: string; mark: { name: string; value: number } | null; unit: string }) {
  return (
    <View style={styles.markRow}>
      <Text style={styles.markLabel}>{label}</Text>
      <Text style={styles.markValue}>{mark ? `${mark.value}${unit}` : '—'}</Text>
      <Text style={styles.markName} numberOfLines={1}>
        {mark ? mark.name : 'Sin registros'}
      </Text>
    </View>
  );
}

export function ProgressTable({ report }: { report: ClientReport }) {
  const cell = (row: ClientReport['months'][number], key: (typeof COLS)[number]['key']) => {
    const v = row[key];
    if (key === 'seconds') return Number(v) > 0 ? `${v}s` : '—';
    if (key === 'volumeKg') return Number(v) > 0 ? `${Number(v).toLocaleString('es-ES')} kg` : '—';
    return String(v);
  };

  return (
    <View>
      <View style={styles.tiles}>
        <Tile value={report.totalWorkouts} label="Entrenos" />
        <Tile value={report.daysTrained} label="Días" />
        <Tile value={report.hoursTrained} label="Horas" />
        <Tile value={report.avgRest} label="Descanso" />
      </View>

      <Text style={styles.sectionTitle}>Mejores marcas</Text>
      <View style={styles.marksRow}>
        <View style={styles.marksCol}>
          <Text style={styles.marksHead}>Empuje</Text>
          <MarkRow label="Isométrico" mark={report.push.secs} unit="s" />
          <MarkRow label="Repeticiones" mark={report.push.reps} unit=" reps" />
        </View>
        <View style={styles.marksCol}>
          <Text style={styles.marksHead}>Tirón</Text>
          <MarkRow label="Isométrico" mark={report.pull.secs} unit="s" />
          <MarkRow label="Repeticiones" mark={report.pull.reps} unit=" reps" />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Entrenamiento por mes</Text>
      {report.months.length === 0 ? (
        <Text style={styles.empty}>Sin entrenamientos registrados todavía.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={[styles.row, styles.headRow]}>
              {COLS.map((c) => (
                <Text key={c.key} style={[styles.headCell, { width: c.width }]}>
                  {c.label}
                </Text>
              ))}
            </View>
            {report.months.map((m, i) => (
              <View key={m.label} style={[styles.row, i % 2 === 1 && styles.rowAlt]}>
                {COLS.map((c) => (
                  <Text
                    key={c.key}
                    style={[styles.cell, { width: c.width }, c.key === 'label' && styles.cellMonth]}
                    numberOfLines={1}
                  >
                    {cell(m, c.key)}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {report.lastWeightKg !== null ? (
        <>
          <Text style={styles.sectionTitle}>Peso</Text>
          <Text style={styles.weightLine}>
            Actual: <Text style={styles.weightStrong}>{report.lastWeightKg} kg</Text>
            {report.weightChange !== null ? (
              <>
                {'  ·  Desde el inicio: '}
                <Text style={styles.weightStrong}>
                  {Number(report.weightChange) >= 0 ? '+' : ''}
                  {report.weightChange} kg
                </Text>
              </>
            ) : null}
          </Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: 120,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileValue: { ...typography.h2, color: colors.primary },
  tileLabel: {
    ...typography.small,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.primaryBright,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  marksRow: { flexDirection: 'row', gap: spacing.sm },
  marksCol: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  marksHead: {
    ...typography.small,
    color: colors.text,
    fontFamily: fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  markRow: { paddingVertical: 3 },
  markLabel: { ...typography.small, color: colors.textMuted },
  markValue: { ...typography.body, color: colors.primary, fontFamily: fonts.semiBold },
  markName: { ...typography.small, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center' },
  headRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.xs,
    marginBottom: 2,
  },
  rowAlt: { backgroundColor: colors.surfaceAlt },
  headCell: {
    ...typography.small,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: spacing.xs,
  },
  cell: { ...typography.small, color: colors.text, paddingVertical: 9, paddingHorizontal: spacing.xs },
  cellMonth: { color: colors.text, fontFamily: fonts.semiBold },
  weightLine: { ...typography.body, color: colors.textMuted },
  weightStrong: { color: colors.primary, fontFamily: fonts.semiBold },
  empty: { ...typography.small, color: colors.textMuted },
});
