import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProgressBar } from './ProgressBar';
import { planCalendar, planSummary, type CalendarWeek } from '../lib/cyclePlan';
import { diaMes } from '../lib/fechas';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import type { TrainingCycle, WorkoutLog } from '../lib/types';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/**
 * El calendario del plan: una fila por semana, agrupadas por bloque, con los
 * días que el alumno entrenó y el cumplimiento de cada semana.
 *
 * Es la pantalla que convierte los ciclos en algo útil. Una lista de ciclos con
 * fechas no dice nada; ver catorce semanas seguidas y dónde se cayó el alumno
 * es lo que permite corregir a tiempo, que es para lo que se planifica.
 */
export function PlanCalendar({
  root,
  cycles,
  logs,
  onPressWeek,
  compact = false,
}: {
  root: TrainingCycle;
  cycles: TrainingCycle[];
  logs: WorkoutLog[];
  onPressWeek?: (week: CalendarWeek) => void;
  /** Solo la semana actual y las dos siguientes (para la ficha del alumno). */
  compact?: boolean;
}) {
  const { weeks, resumen } = useMemo(() => {
    const todas = planCalendar(root, cycles, logs);
    return { weeks: todas, resumen: planSummary(todas) };
  }, [root, cycles, logs]);

  const visibles = useMemo(() => {
    if (!compact) return weeks;
    const actual = weeks.findIndex((w) => w.isCurrent);
    const desde = actual < 0 ? 0 : Math.max(0, actual);
    return weeks.slice(desde, desde + 3);
  }, [weeks, compact]);

  return (
    <View>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.weekBig}>
            {resumen.week > 0 ? `Semana ${resumen.week}` : 'Sin empezar'}
            {resumen.totalWeeks ? <Text style={styles.weekOf}> de {resumen.totalWeeks}</Text> : null}
          </Text>
          <Text style={styles.headHint} numberOfLines={1}>
            {resumen.block ? resumen.block.name : root.name}
            {resumen.isDeload ? ' · semana de descarga' : ''}
          </Text>
        </View>
        {resumen.adherence != null ? (
          <View style={styles.adherenceBox}>
            <Text style={styles.adherencePct}>{Math.round(resumen.adherence * 100)}%</Text>
            <Text style={styles.adherenceLabel}>
              {resumen.done}/{resumen.planned} entrenos
            </Text>
          </View>
        ) : null}
      </View>

      {resumen.adherence != null ? (
        <View style={{ marginBottom: spacing.md }}>
          <ProgressBar progress={resumen.adherence} height={6} />
        </View>
      ) : null}

      {visibles.map((w, i) => {
        const nuevoBloque = w.blockStart || i === 0;
        const cumple = w.target ? w.done >= w.target : w.done > 0;
        const futura = !w.isPast && !w.isCurrent;
        const fila = (
          <View style={[styles.weekRow, w.isCurrent && styles.weekRowNow]}>
            <View style={[styles.band, w.isDeload && styles.bandDeload, w.isPast && styles.bandPast]} />
            <View style={styles.weekLabelBox}>
              <Text style={[styles.weekNum, w.isCurrent && styles.weekNumNow]}>S{w.index}</Text>
              <Text style={styles.weekDates}>{diaMes(w.start)}</Text>
            </View>

            <View style={styles.daysRow}>
              {w.days.map((hecho, d) => (
                <View key={d} style={styles.dayCell}>
                  <View
                    style={[
                      styles.dayDot,
                      hecho && styles.dayDotDone,
                      hecho && w.isDeload && styles.dayDotDeload,
                    ]}
                  />
                  <Text style={styles.dayLetter}>{WEEKDAYS[d]}</Text>
                </View>
              ))}
            </View>

            <View style={styles.countBox}>
              {/* Una semana que no ha empezado enseña lo previsto y ya: un
                  "0/4" en una semana futura acusa de algo que todavía no ha
                  tenido ocasión de pasar. */}
              <Text style={[styles.count, cumple && styles.countOk]}>
                {futura ? (
                  <Text style={styles.countTarget}>{w.target ?? '·'}</Text>
                ) : (
                  <>
                    {w.done}
                    {w.target ? <Text style={styles.countTarget}>/{w.target}</Text> : null}
                  </>
                )}
              </Text>
              {w.isDeload ? <Text style={styles.deloadTag}>descarga</Text> : null}
            </View>
          </View>
        );

        return (
          <View key={w.start}>
            {nuevoBloque && w.block ? (
              <View style={styles.blockHead}>
                <Text style={styles.blockName} numberOfLines={1}>
                  {w.block.name}
                </Text>
                <Text style={styles.blockWeeks}>
                  {w.blockWeeks} sem{w.blockWeeks === 1 ? '' : 's'}
                </Text>
              </View>
            ) : null}
            {onPressWeek && w.micro ? (
              <Pressable onPress={() => onPressWeek(w)}>{fila}</Pressable>
            ) : (
              fila
            )}
          </View>
        );
      })}

      {compact && weeks.length > visibles.length ? (
        <View style={styles.moreRow}>
          <Ionicons name="ellipsis-horizontal" size={16} color={colors.textFaint} />
          <Text style={styles.moreText}>
            {weeks.length - visibles.length} semana
            {weeks.length - visibles.length === 1 ? '' : 's'} más en el plan
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  weekBig: { ...typography.h2, color: colors.text },
  weekOf: { ...typography.h3, color: colors.textMuted, fontFamily: fonts.medium },
  headHint: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  adherenceBox: { alignItems: 'flex-end' },
  adherencePct: { ...typography.h3, color: colors.primaryBright },
  adherenceLabel: { ...typography.small, color: colors.textFaint, fontSize: 11 },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  blockName: {
    ...typography.label,
    color: colors.primaryBright,
    textTransform: 'uppercase',
    flex: 1,
  },
  blockWeeks: { ...typography.small, color: colors.textFaint, fontSize: 11 },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
    borderRadius: radius.md,
  },
  weekRowNow: { backgroundColor: colors.primaryMuted },
  band: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: colors.primary },
  bandDeload: { backgroundColor: colors.textMuted },
  bandPast: { opacity: 0.45 },
  weekLabelBox: { width: 46 },
  weekNum: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  weekNumNow: { color: colors.primaryBright },
  weekDates: { fontSize: 10, color: colors.textFaint, fontFamily: fonts.medium },
  daysRow: { flexDirection: 'row', flex: 1, gap: 2 },
  dayCell: { flex: 1, alignItems: 'center', gap: 2 },
  dayDot: {
    width: 16,
    height: 16,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayDotDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayDotDeload: { backgroundColor: colors.textMuted, borderColor: colors.textMuted },
  dayLetter: { fontSize: 9, color: colors.textFaint, fontFamily: fonts.medium },
  countBox: { width: 46, alignItems: 'flex-end' },
  count: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  countOk: { color: colors.primaryBright },
  countTarget: { color: colors.textFaint, fontFamily: fonts.medium },
  deloadTag: { fontSize: 9, color: colors.textFaint, fontFamily: fonts.medium },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  moreText: { ...typography.small, color: colors.textFaint },
});
