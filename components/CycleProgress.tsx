import { inicioDeLaSemana, inicioDelDia, mesCorto } from '../lib/fechas';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { TrainingCycle, WorkoutLog } from '../lib/types';
import { isLogInCycle } from '../lib/cycleStats';
import { fonts, colors, radius, spacing, typography } from '../lib/theme';

const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/**
 * Progreso del mesociclo en formato mini-calendario: cuántas semanas lleva el
 * alumno entrenando en el ciclo y qué días concretos (del mes) entrenó.
 * Compartido por coach y alumno.
 */
export function CycleProgress({
  cycle,
  logs,
}: {
  cycle: TrainingCycle;
  logs: WorkoutLog[];
}) {
  const model = useMemo(() => {
    const now = Date.now();
    const cycleLogs = logs.filter((l) => isLogInCycle(l, cycle));
    const trained = new Set(cycleLogs.map((l) => inicioDelDia(l.date)));

    // Rango del calendario: desde el inicio del ciclo (o del primer entreno) hasta
    // hoy (o el fin del ciclo si ya terminó).
    const anchorStart =
      cycle.startDate ??
      (cycleLogs.length > 0 ? Math.min(...cycleLogs.map((l) => l.date)) : now);
    const cappedNow = cycle.endDate ? Math.min(now, cycle.endDate) : now;
    const firstWeek = inicioDeLaSemana(anchorStart);
    const lastWeek = inicioDeLaSemana(Math.max(cappedNow, anchorStart));

    // Semanas totales previstas (si el coach fijó fin) y semana actual.
    const totalWeeks =
      cycle.startDate && cycle.endDate
        ? Math.max(1, Math.round((cycle.endDate - cycle.startDate) / DAY_MS / 7))
        : null;
    const weeksElapsed = Math.floor((lastWeek - firstWeek) / (7 * DAY_MS)) + 1;

    // Construye filas de semanas × 7 días.
    const weeks: {
      days: { ts: number; day: number; trained: boolean; inCycle: boolean; isToday: boolean }[];
      monthLabel: string | null;
    }[] = [];
    const today = inicioDelDia(now);
    const cycleStartDay = cycle.startDate ? inicioDelDia(cycle.startDate) : firstWeek;
    const cycleEndDay = cycle.endDate ? inicioDelDia(cycle.endDate) : lastWeek + 6 * DAY_MS;
    let lastMonth = -1;
    for (let w = firstWeek; w <= lastWeek; w += 7 * DAY_MS) {
      const days = [];
      let monthLabel: string | null = null;
      for (let i = 0; i < 7; i++) {
        const ts = w + i * DAY_MS;
        const d = new Date(ts);
        const m = d.getMonth();
        if (monthLabel === null && m !== lastMonth) {
          monthLabel = mesCorto(d);
          lastMonth = m;
        }
        days.push({
          ts,
          day: d.getDate(),
          trained: trained.has(ts),
          inCycle: ts >= cycleStartDay && ts <= cycleEndDay,
          isToday: ts === today,
        });
      }
      weeks.push({ days, monthLabel });
    }

    return { weeks, weeksElapsed, totalWeeks, sessions: cycleLogs.length };
  }, [cycle, logs]);

  return (
    <View>
      <View style={styles.header}>
        <View>
          <Text style={styles.weekBig}>
            Semana {model.weeksElapsed}
            {model.totalWeeks ? <Text style={styles.weekOf}> de {model.totalWeeks}</Text> : null}
          </Text>
          <Text style={styles.hint}>
            {model.sessions} {model.sessions === 1 ? 'entreno' : 'entrenos'} en el mesociclo
          </Text>
        </View>
      </View>

      <View style={styles.weekdayRow}>
        <View style={styles.monthGutter} />
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={styles.weekdayLabel}>
            {d}
          </Text>
        ))}
      </View>

      {model.weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          <Text style={styles.monthGutterText} numberOfLines={1}>
            {week.monthLabel ?? ''}
          </Text>
          {week.days.map((cell) => (
            <View key={cell.ts} style={styles.cellWrap}>
              <View
                style={[
                  styles.cell,
                  !cell.inCycle && styles.cellOut,
                  cell.trained && styles.cellTrained,
                  cell.isToday && styles.cellToday,
                ]}
              >
                <Text
                  style={[
                    styles.cellText,
                    !cell.inCycle && styles.cellTextOut,
                    cell.trained && styles.cellTextTrained,
                  ]}
                >
                  {cell.day}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ))}

      <View style={styles.legend}>
        <View style={[styles.dot, styles.cellTrained]} />
        <Text style={styles.legendText}>Día entrenado</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.md },
  weekBig: { ...typography.h2, color: colors.text },
  weekOf: { ...typography.h3, color: colors.textMuted, fontFamily: fonts.medium },
  hint: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  weekdayRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  monthGutter: { width: 30 },
  monthGutterText: {
    width: 30,
    fontSize: 10,
    color: colors.textFaint,
    fontFamily: fonts.semiBold,
    textTransform: 'uppercase',
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    color: colors.textFaint,
    fontFamily: fonts.semiBold,
  },
  weekRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cellWrap: { flex: 1, alignItems: 'center' },
  cell: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cellOut: { backgroundColor: 'transparent', borderColor: 'transparent' },
  cellTrained: { backgroundColor: colors.primary, borderColor: colors.primary },
  cellToday: { borderColor: colors.primaryBright },
  cellText: { fontSize: 12, color: colors.textMuted, fontFamily: fonts.medium },
  cellTextOut: { color: colors.textFaint, opacity: 0.5 },
  cellTextTrained: { color: colors.onPrimary, fontFamily: fonts.heading },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  dot: { width: 12, height: 12, borderRadius: 4 },
  legendText: { fontSize: 11, color: colors.textMuted, fontFamily: fonts.medium },
});
