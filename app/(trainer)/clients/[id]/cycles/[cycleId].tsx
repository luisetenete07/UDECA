import React, { useCallback, useState } from 'react';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../../../components/Button';
import { Card } from '../../../../../components/Card';
import { CycleProgress } from '../../../../../components/CycleProgress';
import { CycleSheet } from '../../../../../components/CycleSheet';
import { WeekPlanSheet } from '../../../../../components/WeekPlanSheet';
import { EmptyState } from '../../../../../components/EmptyState';
import { LoadingScreen } from '../../../../../components/LoadingScreen';
import { PlanCalendar } from '../../../../../components/PlanCalendar';
import { ProgressBar } from '../../../../../components/ProgressBar';
import { ScreenContainer } from '../../../../../components/ScreenContainer';
import { StatTile } from '../../../../../components/StatTile';
import { showToast } from '../../../../../components/Toast';
import { useAuth } from '../../../../../lib/auth-context';
import { BlockOverview } from '../../../../../components/BlockOverview';
import { deleteCycles, getCyclesForClient } from '../../../../../lib/firestore/cycles';
import { getExerciseLibrary } from '../../../../../lib/firestore/exercises';
import { getActiveRoutineForClient } from '../../../../../lib/firestore/routines';
import { getWorkoutLogsForClient } from '../../../../../lib/firestore/workoutLogs';
import { computeCycleStats } from '../../../../../lib/cycleStats';
import { descendantIds } from '../../../../../lib/cyclePlan';
import { buildBlockView } from '../../../../../lib/blockView';
import { colors, fonts, radius, spacing, typography } from '../../../../../lib/theme';
import {
  CYCLE_LEVEL_LABEL,
  type Routine,
  type TrainingCycle,
  type WorkoutLog,
} from '../../../../../lib/types';

function fmt(ts: number): string {
  return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function CycleDashboardScreen() {
  const { id, cycleId } = useLocalSearchParams<{ id: string; cycleId: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const [cycles, setCycles] = useState<TrainingCycle[]>([]);
  const [cycle, setCycle] = useState<TrainingCycle | null>(null);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [muscleByExercise, setMuscleByExercise] = useState<Record<string, string>>({});
  const [measureByExercise, setMeasureByExercise] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [weekOpen, setWeekOpen] = useState(false);

  const load = useCallback(async () => {
    if (!profile || !id || !cycleId) return;
    const [cyclesData, logsData, rutina, biblioteca] = await Promise.all([
      getCyclesForClient(profile.uid, id),
      getWorkoutLogsForClient(id, profile.uid),
      getActiveRoutineForClient(id, profile.uid).catch(() => null),
      getExerciseLibrary(profile.uid).catch(() => []),
    ]);
    setCycles(cyclesData);
    setCycle(cyclesData.find((c) => c.id === cycleId) ?? null);
    setLogs(logsData);
    setRoutine(rutina);
    setMuscleByExercise(Object.fromEntries(biblioteca.map((e) => [e.id, e.muscleGroup])));
    setMeasureByExercise(Object.fromEntries(biblioteca.map((e) => [e.id, e.measure ?? 'reps'])));
    setLoading(false);
  }, [profile, id, cycleId]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setLoading(false));
    }, [load])
  );

  const cuelgan = cycleId ? descendantIds(cycles, cycleId) : [];

  const handleDelete = async () => {
    if (!cycleId) return;
    try {
      await deleteCycles([cycleId, ...cuelgan]);
      showToast(cuelgan.length > 0 ? 'Plan eliminado' : 'Ciclo eliminado');
      router.replace(`/(trainer)/clients/${id}/planning`);
    } catch {
      showToast('No se pudo eliminar');
    }
  };

  if (loading) return <LoadingScreen />;
  if (!cycle)
    return (
      <>
        <Stack.Screen options={{ title: 'Ciclo' }} />
        <EmptyState title="Ciclo no encontrado" />
      </>
    );

  const stats = computeCycleStats(cycle, logs);
  const pctText = stats.pctComplete != null ? `${Math.round(stats.pctComplete * 100)}%` : '—';
  const padre = cycle.parentId ? (cycles.find((c) => c.id === cycle.parentId) ?? null) : null;
  const hijos = cycles
    .filter((c) => c.parentId === cycle.id)
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: CYCLE_LEVEL_LABEL[cycle.level] }} />

      {padre ? (
        <Pressable
          style={styles.breadcrumb}
          onPress={() => router.push(`/(trainer)/clients/${id}/cycles/${padre.id}`)}
        >
          <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
          <Text style={styles.breadcrumbText} numberOfLines={1}>
            {padre.name}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.headRow}>
        <Text style={styles.level}>{CYCLE_LEVEL_LABEL[cycle.level]}</Text>
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{stats.statusLabel}</Text>
        </View>
        {cycle.isDeload ? (
          <View style={[styles.statusPill, styles.deloadPill]}>
            <Text style={styles.deloadText}>Descarga</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.name}>{cycle.name}</Text>
      <Text style={styles.dates}>
        {cycle.startDate ? fmt(cycle.startDate) : 'Sin inicio'}
        {cycle.endDate ? ` – ${fmt(cycle.endDate)}` : cycle.startDate ? ' · abierto' : ''}
        {stats.durationDays ? ` · ${Math.round(stats.durationDays / 7)} sem` : ''}
        {stats.daysElapsed != null && stats.status === 'active'
          ? ` · lleva ${stats.daysElapsed} días`
          : ''}
      </Text>

      {stats.pctComplete != null ? (
        <View style={{ marginTop: spacing.md }}>
          <ProgressBar progress={stats.pctComplete} height={8} />
        </View>
      ) : null}

      {/* Una sola semana no tiene reparto que analizar: sus números ya están
          arriba, y hablar "del bloque" mirando siete días es confundir. */}
      {cycle.level !== 'micro' ? (
        <Card style={styles.section}>
          <BlockOverview
            view={buildBlockView({
              cycle,
              cycles,
              logs,
              routine,
              muscleByExercise,
              measureByExercise,
            })}
            title={cycle.name}
            subtitle={`${CYCLE_LEVEL_LABEL[cycle.level]} · ${stats.sessionsDone} entreno${
              stats.sessionsDone === 1 ? '' : 's'
            }`}
            onPressDetail={() => router.push(`/(trainer)/clients/${id}/overview`)}
          />
        </Card>
      ) : null}

      <View style={styles.tilesRow}>
        <StatTile icon="pie-chart" value={pctText} label="Completado" highlight />
        <StatTile
          icon="checkmark-done"
          value={
            stats.targetSessions
              ? `${stats.sessionsDone}/${stats.targetSessions}`
              : String(stats.sessionsDone)
          }
          label="Sesiones"
        />
      </View>
      <View style={styles.tilesRow}>
        <StatTile
          icon="repeat"
          value={
            stats.sessionsPerWeek != null
              ? stats.sessionsPerWeek.toLocaleString('es-ES', { maximumFractionDigits: 1 })
              : '—'
          }
          label="Por semana"
        />
        <StatTile
          icon="barbell"
          value={
            stats.totalVolumeKg > 0 ? stats.totalVolumeKg.toLocaleString('es-ES') : '—'
          }
          label="Volumen (kg)"
        />
      </View>

      <Card style={styles.section}>
        {hijos.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Calendario del plan</Text>
            <PlanCalendar
              root={cycle}
              cycles={cycles}
              logs={logs}
              onPressWeek={(w) =>
                w.micro && router.push(`/(trainer)/clients/${id}/cycles/${w.micro.id}`)
              }
            />
          </>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Días entrenados</Text>
            <CycleProgress cycle={cycle} logs={logs} />
          </>
        )}
      </Card>

      {hijos.length > 0 ? (
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>
            {CYCLE_LEVEL_LABEL[hijos[0].level]}s ({hijos.length})
          </Text>
          {hijos.map((h) => {
            const hs = computeCycleStats(h, logs);
            return (
              <Pressable
                key={h.id}
                style={styles.logRow}
                onPress={() => router.push(`/(trainer)/clients/${id}/cycles/${h.id}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.logDay}>{h.name}</Text>
                  <Text style={styles.logMeta}>
                    {h.startDate ? fmt(h.startDate) : '—'}
                    {h.endDate ? ` – ${fmt(h.endDate)}` : ''} · {hs.sessionsDone}
                    {h.targetSessions ? `/${h.targetSessions}` : ''} entrenos
                    {h.isDeload ? ' · descarga' : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      {cycle.goal ? (
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>Objetivo</Text>
          <Text style={styles.goalText}>{cycle.goal}</Text>
        </Card>
      ) : null}

      {cycle.notes ? (
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>Notas</Text>
          <Text style={styles.notesText}>{cycle.notes}</Text>
        </Card>
      ) : null}

      <Card style={styles.section}>
        <Text style={styles.sectionLabel}>Entrenos del ciclo ({stats.logs.length})</Text>
        {stats.logs.length === 0 ? (
          <Text style={styles.mutedText}>
            Aún no hay entrenos en este rango de fechas. Aparecerán aquí cuando el alumno entrene.
          </Text>
        ) : (
          stats.logs.map((log) => (
            <Pressable
              key={log.id}
              style={styles.logRow}
              onPress={() =>
                router.push(`/(trainer)/clients/${id}/session?logId=${log.id}`)
              }
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.logDay}>{log.dayName}</Text>
                <Text style={styles.logMeta}>
                  {new Date(log.date).toLocaleDateString('es-ES', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                  {log.durationMin ? ` · ${log.durationMin} min` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            </Pressable>
          ))
        )}
      </Card>

      {cycle.level === 'micro' ? (
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>Programación de la semana</Text>
          <Text style={styles.mutedText}>
            {(cycle.weekPlan ?? []).length > 0
              ? `${(cycle.weekPlan ?? []).length} ejercicios con números propios esta semana. Tu alumno los ve en su entreno.`
              : 'Esta semana se hace la rutina tal cual. Prográmala si quieres subir series, repeticiones o apretar el RIR.'}
          </Text>
          <Button
            title={(cycle.weekPlan ?? []).length > 0 ? 'Editar la semana' : 'Programar la semana'}
            variant="secondary"
            onPress={() => setWeekOpen(true)}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      ) : null}

      <View style={styles.actions}>
        <Button
          title="Editar ciclo"
          variant="secondary"
          onPress={() => setEditOpen(true)}
          style={{ flex: 1 }}
        />
        <Button
          title="Eliminar"
          variant="danger"
          onPress={() => setConfirmDelete(true)}
          style={{ flex: 1 }}
        />
      </View>

      {cycle.level === 'micro' ? (
        <WeekPlanSheet
          visible={weekOpen}
          micro={cycle}
          cycles={cycles}
          routine={routine}
          onClose={() => setWeekOpen(false)}
          onSaved={load}
        />
      ) : null}

      {profile && id ? (
        <CycleSheet
          visible={editOpen}
          trainerId={profile.uid}
          clientId={id}
          cycle={cycle}
          onClose={() => setEditOpen(false)}
          onSaved={load}
        />
      ) : null}

      <Modal visible={confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(false)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>
              {cuelgan.length > 0 ? '¿Eliminar el plan entero?' : '¿Eliminar este ciclo?'}
            </Text>
            <Text style={styles.confirmText}>
              {cuelgan.length > 0
                ? `Se borran también los ${cuelgan.length} ciclos que cuelgan de él (bloques y semanas). `
                : 'Se borra solo el ciclo. '}
              Los entrenos del alumno y su historial no se tocan.
            </Text>
            <View style={styles.actions}>
              <Button
                title="Cancelar"
                variant="ghost"
                onPress={() => setConfirmDelete(false)}
                style={{ flex: 1 }}
              />
              <Button title="Eliminar" variant="danger" onPress={handleDelete} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: spacing.xs,
    alignSelf: 'flex-start',
  },
  breadcrumbText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.medium },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  level: {
    ...typography.label,
    color: colors.primary,
    textTransform: 'uppercase',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  statusText: { ...typography.small, color: colors.textMuted, fontSize: 11, fontFamily: fonts.semiBold },
  deloadPill: { borderColor: colors.hairline, backgroundColor: colors.primaryMuted },
  deloadText: { ...typography.small, color: colors.primaryBright, fontSize: 11, fontFamily: fonts.semiBold },
  name: { ...typography.h1, color: colors.text, fontSize: 26 },
  dates: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  tilesRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  section: { marginTop: spacing.md },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  goalText: { ...typography.body, color: colors.text },
  notesText: { ...typography.body, color: colors.textMuted, lineHeight: 21 },
  mutedText: { ...typography.small, color: colors.textMuted, lineHeight: 19 },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  logDay: { ...typography.body, color: colors.text, fontFamily: fonts.medium },
  logMeta: { ...typography.small, color: colors.textFaint, marginTop: 1, textTransform: 'capitalize' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  confirmBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: spacing.lg,
  },
  confirmCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 420,
  },
  confirmTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  confirmText: { ...typography.small, color: colors.textMuted, lineHeight: 19 },
});
