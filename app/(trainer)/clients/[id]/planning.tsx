import React, { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../../components/Card';
import { CycleSheet } from '../../../../components/CycleSheet';
import { EmptyState } from '../../../../components/EmptyState';
import { LoadingScreen } from '../../../../components/LoadingScreen';
import { ProgressBar } from '../../../../components/ProgressBar';
import { ScreenContainer } from '../../../../components/ScreenContainer';
import { useAuth } from '../../../../lib/auth-context';
import { getCyclesForClient } from '../../../../lib/firestore/cycles';
import { getWorkoutLogsForClient } from '../../../../lib/firestore/workoutLogs';
import { computeCycleStats } from '../../../../lib/cycleStats';
import { colors, fonts, radius, spacing, typography } from '../../../../lib/theme';
import {
  CYCLE_LEVEL_LABEL,
  type CycleLevel,
  type TrainingCycle,
  type WorkoutLog,
} from '../../../../lib/types';

const LEVEL_ORDER: CycleLevel[] = ['macro', 'meso', 'micro'];

const STATUS_TONE: Record<string, string> = {
  active: colors.primary,
  planned: colors.textMuted,
  completed: colors.textFaint,
  open: colors.primary,
};

export default function PlanningScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const [cycles, setCycles] = useState<TrainingCycle[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async () => {
    if (!profile || !id) return;
    const [cyclesData, logsData] = await Promise.all([
      getCyclesForClient(profile.uid, id),
      getWorkoutLogsForClient(id, profile.uid),
    ]);
    setCycles(cyclesData);
    setLogs(logsData);
    setLoading(false);
  }, [profile, id]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => setLoading(false));
    }, [load])
  );

  if (loading) return <LoadingScreen />;

  const byLevel = (level: CycleLevel) => cycles.filter((c) => c.level === level);

  return (
    <ScreenContainer>
      <Text style={styles.title}>Planificación</Text>
      <Text style={styles.subtitle}>
        Los ciclos son opcionales. Úsalos para agrupar el trabajo y ver la evolución del alumno.
      </Text>

      <Pressable style={styles.createBtn} onPress={() => setSheetOpen(true)}>
        <Ionicons name="add-circle" size={20} color={colors.onPrimary} />
        <Text style={styles.createText}>Nuevo ciclo</Text>
      </Pressable>

      {cycles.length === 0 ? (
        <EmptyState
          icon="layers-outline"
          title="Sin ciclos todavía"
          subtitle="Crea un macro, meso o microciclo cuando quieras planificar por bloques. Si no, el alumno entrena igual que siempre."
        />
      ) : (
        LEVEL_ORDER.map((level) => {
          const list = byLevel(level);
          if (list.length === 0) return null;
          return (
            <View key={level} style={styles.section}>
              <Text style={styles.sectionLabel}>{CYCLE_LEVEL_LABEL[level]}s</Text>
              {list.map((cycle) => {
                const stats = computeCycleStats(cycle, logs);
                return (
                  <Pressable
                    key={cycle.id}
                    onPress={() => router.push(`/(trainer)/clients/${id}/cycles/${cycle.id}`)}
                  >
                    <Card style={styles.cycleCard}>
                      <View style={styles.cycleHead}>
                        <Text style={styles.cycleName} numberOfLines={1}>
                          {cycle.name}
                        </Text>
                        <View style={styles.statusPill}>
                          <View
                            style={[
                              styles.statusDot,
                              { backgroundColor: STATUS_TONE[stats.status] },
                            ]}
                          />
                          <Text style={styles.statusText}>{stats.statusLabel}</Text>
                        </View>
                      </View>
                      <Text style={styles.cycleMeta}>
                        {cycle.isDeload ? 'Descarga · ' : ''}
                        {stats.sessionsDone} entreno{stats.sessionsDone === 1 ? '' : 's'}
                        {stats.targetSessions ? ` / ${stats.targetSessions}` : ''}
                        {stats.durationDays ? ` · ${Math.round(stats.durationDays / 7)} sem` : ''}
                        {stats.sessionsPerWeek != null ? ` · ${stats.sessionsPerWeek}/sem` : ''}
                      </Text>
                      {stats.pctComplete != null ? (
                        <View style={{ marginTop: spacing.sm }}>
                          <ProgressBar progress={stats.pctComplete} height={6} />
                        </View>
                      ) : null}
                      <View style={styles.chevron}>
                        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          );
        })
      )}

      {profile && id ? (
        <CycleSheet
          visible={sheetOpen}
          trainerId={profile.uid}
          clientId={id}
          onClose={() => setSheetOpen(false)}
          onSaved={load}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  createText: { ...typography.h3, color: colors.onPrimary },
  section: { marginBottom: spacing.md },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  cycleCard: { marginBottom: spacing.sm },
  cycleHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cycleName: { ...typography.h3, color: colors.text, flex: 1 },
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
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { ...typography.small, color: colors.textMuted, fontSize: 11, fontFamily: fonts.semiBold },
  cycleMeta: { ...typography.small, color: colors.textMuted, marginTop: 4 },
  chevron: { position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center', opacity: 0.6 },
});
