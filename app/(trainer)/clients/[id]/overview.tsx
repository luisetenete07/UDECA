import React, { useCallback, useMemo, useState } from 'react';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../../components/Card';
import { EmptyState } from '../../../../components/EmptyState';
import { LoadingScreen } from '../../../../components/LoadingScreen';
import { ScreenContainer } from '../../../../components/ScreenContainer';
import { useAuth } from '../../../../lib/auth-context';
import { getWorkoutLogsForClient } from '../../../../lib/firestore/workoutLogs';
import { startOfWeek, weeklyExerciseMatrix, type MatrixCell } from '../../../../lib/stats';
import { fonts, colors, radius, spacing, typography } from '../../../../lib/theme';
import type { WorkoutLog } from '../../../../lib/types';

const NAME_W = 132;
const CELL_W = 74;
const HEADER_H = 46;
const ROW_H = 52;

/** Cabecera corta de semana: "14 jul". */
function weekLabel(ts: number): string {
  return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function ClientOverviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<4 | 8 | 12 | 'total'>(8);

  const load = useCallback(async () => {
    if (!profile || !id) return;
    try {
      setLogs(await getWorkoutLogsForClient(id, profile.uid));
    } catch {
      setLogs([]);
    }
    setLoading(false);
  }, [profile, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Semanas totales desde que el alumno entrena (primer registro → hoy), para
  // la opción "Desde el inicio".
  const totalWeeks = useMemo(() => {
    if (logs.length === 0) return 4;
    const earliest = Math.min(...logs.map((l) => l.date));
    const w = Math.floor((startOfWeek(Date.now()) - startOfWeek(earliest)) / (7 * 24 * 60 * 60 * 1000)) + 1;
    return Math.max(1, w);
  }, [logs]);

  const weeks = range === 'total' ? totalWeeks : range;
  const matrix = useMemo(() => weeklyExerciseMatrix(logs, weeks), [logs, weeks]);

  const OPTIONS: { v: 4 | 8 | 12 | 'total'; label: string }[] = [
    { v: 4, label: '4 sem' },
    { v: 8, label: '8 sem' },
    { v: 12, label: '12 sem' },
    { v: 'total', label: 'Desde el inicio' },
  ];

  if (loading) return <LoadingScreen />;

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: 'Progreso semanal' }} />
      <Text style={styles.title}>Progreso semanal</Text>
      <Text style={styles.subtitle}>
        La mejor serie de cada ejercicio, semana a semana. Ideal para reestructurar la rutina.
      </Text>

      <View style={styles.weekToggle}>
        {OPTIONS.map((o) => (
          <Pressable
            key={String(o.v)}
            onPress={() => setRange(o.v)}
            style={[styles.weekBtn, range === o.v && styles.weekBtnOn]}
          >
            <Text style={[styles.weekBtnText, range === o.v && styles.weekBtnTextOn]}>
              {o.label}
              {o.v === 'total' ? ` (${totalWeeks})` : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      {matrix.rows.length === 0 ? (
        <Card style={{ marginTop: spacing.md }}>
          <EmptyState
            icon="grid-outline"
            title="Sin datos todavía"
            subtitle="Cuando el alumno registre entrenamientos, verás aquí su progreso semanal por ejercicio."
          />
        </Card>
      ) : (
        <Card style={styles.tableCard}>
          <View style={styles.tableRow}>
            {/* Columna fija: nombres de ejercicio */}
            <View style={styles.nameCol}>
              <View style={[styles.headerCell, styles.nameHeader]}>
                <Text style={styles.headerText}>Ejercicio</Text>
              </View>
              {matrix.rows.map((r) => (
                <View key={r.exerciseId} style={[styles.nameCell]}>
                  <Text style={styles.nameText} numberOfLines={2}>
                    {r.name}
                  </Text>
                </View>
              ))}
            </View>

            {/* Columnas de semanas: scroll horizontal */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={styles.headerRow}>
                  {matrix.weekStarts.map((w, i) => (
                    <View key={w} style={styles.headerCell}>
                      <Text
                        style={[
                          styles.weekHeadText,
                          i === matrix.weekStarts.length - 1 && styles.weekHeadNow,
                        ]}
                      >
                        {weekLabel(w)}
                      </Text>
                    </View>
                  ))}
                </View>
                {matrix.rows.map((r) => (
                  <View key={r.exerciseId} style={styles.dataRow}>
                    {r.cells.map((cell, i) => {
                      const prev = prevFilled(r.cells, i);
                      return (
                        <View key={i} style={styles.dataCell}>
                          {cell ? (
                            <>
                              <Text style={styles.cellValue}>{cell.label}</Text>
                              <Trend current={cell} prev={prev} />
                            </>
                          ) : (
                            <Text style={styles.cellEmpty}>·</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </Card>
      )}

      {matrix.rows.length > 0 ? (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <Ionicons name="arrow-up" size={13} color="#2E7D5B" />
            <Text style={styles.legendText}>Mejora</Text>
          </View>
          <View style={styles.legendItem}>
            <Ionicons name="arrow-down" size={13} color={colors.danger} />
            <Text style={styles.legendText}>Baja</Text>
          </View>
          <View style={styles.legendItem}>
            <Ionicons name="remove" size={13} color={colors.textFaint} />
            <Text style={styles.legendText}>Igual</Text>
          </View>
          <Text style={styles.legendNote}>reps · reps×lastre · segundos</Text>
        </View>
      ) : null}
    </ScreenContainer>
  );
}

/** Celda rellena anterior a la posición `i` (para comparar tendencia). */
function prevFilled(cells: (MatrixCell | null)[], i: number): MatrixCell | null {
  for (let k = i - 1; k >= 0; k--) {
    if (cells[k]) return cells[k];
  }
  return null;
}

function Trend({ current, prev }: { current: MatrixCell; prev: MatrixCell | null }) {
  if (!prev) return <View style={styles.trendSpace} />;
  if (current.score > prev.score) {
    return <Ionicons name="arrow-up" size={12} color="#2E7D5B" />;
  }
  if (current.score < prev.score) {
    return <Ionicons name="arrow-down" size={12} color={colors.danger} />;
  }
  return <Ionicons name="remove" size={12} color={colors.textFaint} />;
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.small, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  weekToggle: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignSelf: 'stretch',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    gap: 4,
  },
  weekBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm },
  weekBtnOn: { backgroundColor: colors.primary },
  weekBtnText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  weekBtnTextOn: { color: colors.onPrimary },
  tableCard: { padding: 0, overflow: 'hidden' },
  tableRow: { flexDirection: 'row' },
  nameCol: { width: NAME_W, borderRightWidth: 1, borderRightColor: colors.border },
  nameHeader: { alignItems: 'flex-start', paddingLeft: spacing.md },
  headerRow: { flexDirection: 'row' },
  headerCell: {
    width: CELL_W,
    height: HEADER_H,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold, fontSize: 12 },
  weekHeadText: { ...typography.small, color: colors.textFaint, fontSize: 11, fontFamily: fonts.medium },
  weekHeadNow: { color: colors.primaryBright, fontFamily: fonts.semiBold },
  nameCell: {
    width: NAME_W,
    height: ROW_H,
    justifyContent: 'center',
    paddingRight: spacing.sm,
    paddingLeft: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  nameText: { ...typography.small, color: colors.text, fontFamily: fonts.medium, fontSize: 12 },
  dataRow: { flexDirection: 'row' },
  dataCell: {
    width: CELL_W,
    height: ROW_H,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cellValue: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold, fontSize: 13 },
  cellEmpty: { ...typography.small, color: colors.textFaint },
  trendSpace: { width: 12 },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { ...typography.small, color: colors.textMuted, fontSize: 12 },
  legendNote: { ...typography.small, color: colors.textFaint, fontSize: 11, marginLeft: 'auto' },
});
