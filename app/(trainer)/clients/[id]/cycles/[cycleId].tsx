import React, { useCallback, useState } from 'react';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../../../components/Button';
import { Card } from '../../../../../components/Card';
import { CycleProgress } from '../../../../../components/CycleProgress';
import { CycleSheet } from '../../../../../components/CycleSheet';
import { EmptyState } from '../../../../../components/EmptyState';
import { LoadingScreen } from '../../../../../components/LoadingScreen';
import { ProgressBar } from '../../../../../components/ProgressBar';
import { ScreenContainer } from '../../../../../components/ScreenContainer';
import { StatTile } from '../../../../../components/StatTile';
import { showToast } from '../../../../../components/Toast';
import { useAuth } from '../../../../../lib/auth-context';
import { deleteCycle, getCyclesForClient } from '../../../../../lib/firestore/cycles';
import { getWorkoutLogsForClient } from '../../../../../lib/firestore/workoutLogs';
import { computeCycleStats } from '../../../../../lib/cycleStats';
import { colors, fonts, radius, spacing, typography } from '../../../../../lib/theme';
import { CYCLE_LEVEL_LABEL, type TrainingCycle, type WorkoutLog } from '../../../../../lib/types';

function fmt(ts: number): string {
  return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function CycleDashboardScreen() {
  const { id, cycleId } = useLocalSearchParams<{ id: string; cycleId: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const [cycle, setCycle] = useState<TrainingCycle | null>(null);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    if (!profile || !id || !cycleId) return;
    const [cyclesData, logsData] = await Promise.all([
      getCyclesForClient(profile.uid, id),
      getWorkoutLogsForClient(id, profile.uid),
    ]);
    setCycle(cyclesData.find((c) => c.id === cycleId) ?? null);
    setLogs(logsData);
    setLoading(false);
  }, [profile, id, cycleId]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setLoading(false));
    }, [load])
  );

  const handleDelete = async () => {
    if (!cycleId) return;
    try {
      await deleteCycle(cycleId);
      showToast('Ciclo eliminado');
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

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: CYCLE_LEVEL_LABEL[cycle.level] }} />

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
          value={stats.sessionsPerWeek != null ? String(stats.sessionsPerWeek) : '—'}
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
        <Text style={styles.sectionLabel}>Progreso del mesociclo</Text>
        <CycleProgress cycle={cycle} logs={logs} />
      </Card>

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
            <Text style={styles.confirmTitle}>¿Eliminar este ciclo?</Text>
            <Text style={styles.confirmText}>
              Se borra solo el ciclo. Los entrenos del alumno y su historial no se tocan.
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
  mutedText: { ...typography.small, color: colors.textFaint },
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
