import React, { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../../../../components/Texto';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../../components/Card';
import { CyclePlanSheet } from '../../../../components/CyclePlanSheet';
import { CycleSheet } from '../../../../components/CycleSheet';
import { EmptyState } from '../../../../components/EmptyState';
import { LoadingScreen } from '../../../../components/LoadingScreen';
import { PlanCalendar } from '../../../../components/PlanCalendar';
import { ProgressBar } from '../../../../components/ProgressBar';
import { ScreenContainer } from '../../../../components/ScreenContainer';
import { useAuth } from '../../../../lib/auth-context';
import { getCyclesForClient } from '../../../../lib/firestore/cycles';
import { getWorkoutLogsForClient } from '../../../../lib/firestore/workoutLogs';
import { computeCycleStats } from '../../../../lib/cycleStats';
import { buildCycleTree, nombreDeCiclo } from '../../../../lib/cyclePlan';
import { diaMes } from '../../../../lib/fechas';
import { colors, fonts, radius, spacing, typography } from '../../../../lib/theme';
import {
  CYCLE_LEVEL_LABEL,
  type TrainingCycle,
  type WorkoutLog,
} from '../../../../lib/types';

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
  const [planOpen, setPlanOpen] = useState(false);

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

  const abrir = (cycleId: string) => router.push(`/(trainer)/clients/${id}/cycles/${cycleId}`);

  const raiz = buildCycleTree(cycles);
  // Un "plan" es un ciclo con hijos: se pinta como calendario. Lo demás son
  // ciclos sueltos, que siguen siendo una lista sencilla.
  const planes = raiz.filter((n) => n.children.length > 0);
  const sueltos = raiz.filter((n) => n.children.length === 0);

  return (
    <ScreenContainer>
      <Text style={styles.title}>Planificación</Text>
      <Text style={styles.subtitle}>
        Monta la temporada en bloques y comprueba semana a semana si el alumno la está cumpliendo.
      </Text>

      <Pressable style={styles.createBtn} onPress={() => setPlanOpen(true)}>
        <Ionicons name="calendar" size={20} color={colors.onPrimary} />
        <Text style={styles.createText}>Nuevo plan</Text>
      </Pressable>
      <Pressable style={styles.secondaryBtn} onPress={() => setSheetOpen(true)}>
        <Ionicons name="add" size={18} color={colors.primary} />
        <Text style={styles.secondaryText}>Ciclo suelto</Text>
      </Pressable>

      {cycles.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="Sin planificar"
          subtitle="Crea un plan y la app monta el macrociclo con sus bloques y sus semanas. Si prefieres no planificar, el alumno entrena igual que siempre."
        />
      ) : null}

      {planes.map(({ cycle, children }) => (
        <Card key={cycle.id} style={styles.planCard}>
          <Pressable onPress={() => abrir(cycle.id)} style={styles.planHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.planLevel}>{CYCLE_LEVEL_LABEL[cycle.level]}</Text>
              <Text style={styles.planName} numberOfLines={1}>
                {nombreDeCiclo(cycle.name)}
              </Text>
              <Text style={styles.planDates}>
                {cycle.startDate ? diaMes(cycle.startDate) : 'Sin inicio'}
                {cycle.endDate ? ` – ${diaMes(cycle.endDate)}` : ''} · {children.length} bloque
                {children.length === 1 ? '' : 's'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
          </Pressable>

          <View style={styles.planDivider} />

          <PlanCalendar
            root={cycle}
            cycles={cycles}
            logs={logs}
            onPressWeek={(w) => w.micro && abrir(w.micro.id)}
          />
        </Card>
      ))}

      {sueltos.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>Ciclos sueltos</Text>
          {sueltos.map(({ cycle }) => {
            const stats = computeCycleStats(cycle, logs);
            return (
              <Pressable key={cycle.id} onPress={() => abrir(cycle.id)}>
                <Card style={styles.cycleCard}>
                  <View style={styles.cycleHead}>
                    {/* Dos líneas: al lado del distintivo de estado quedan 149
                        píxeles y el nombre del ciclo lo pone el entrenador
                        ("Bloque de fuerza · otoño"). Cortarlo deja la lista con
                        varios ciclos que empiezan igual y no se distinguen. */}
                    <Text style={styles.cycleName} numberOfLines={2}>
                      {nombreDeCiclo(cycle.name)}
                    </Text>
                    <View style={styles.statusPill}>
                      <View
                        style={[styles.statusDot, { backgroundColor: STATUS_TONE[stats.status] }]}
                      />
                      <Text style={styles.statusText}>{stats.statusLabel}</Text>
                    </View>
                  </View>
                  <Text style={styles.cycleMeta}>
                    {CYCLE_LEVEL_LABEL[cycle.level]}
                    {cycle.isDeload ? ' · descarga' : ''} · {stats.sessionsDone} entreno
                    {stats.sessionsDone === 1 ? '' : 's'}
                    {stats.targetSessions ? ` / ${stats.targetSessions}` : ''}
                    {stats.durationDays ? ` · ${Math.round(stats.durationDays / 7)} sem` : ''}
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
        </>
      ) : null}

      {profile && id ? (
        <>
          <CycleSheet
            visible={sheetOpen}
            trainerId={profile.uid}
            clientId={id}
            onClose={() => setSheetOpen(false)}
            onSaved={load}
          />
          <CyclePlanSheet
            visible={planOpen}
            trainerId={profile.uid}
            clientId={id}
            onClose={() => setPlanOpen(false)}
            onSaved={(macroId) => {
              load();
              abrir(macroId);
            }}
          />
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text },
  subtitle: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  createText: { ...typography.h3, color: colors.onPrimary },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.lg,
  },
  secondaryText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  planCard: { marginBottom: spacing.md },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planLevel: { ...typography.label, color: colors.primary, textTransform: 'uppercase' },
  planName: { ...typography.h3, color: colors.text, marginTop: 2 },
  planDates: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  planDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  cycleCard: { marginBottom: spacing.sm },
  cycleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
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
  statusText: {
    ...typography.small,
    color: colors.textMuted,
    fontSize: 11,
    fontFamily: fonts.semiBold,
  },
  cycleMeta: { ...typography.small, color: colors.textMuted, marginTop: 4 },
  chevron: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    opacity: 0.6,
  },
});
