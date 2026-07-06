import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { LoadingScreen } from '../../components/LoadingScreen';
import { RestTimer } from '../../components/RestTimer';
import { ScreenContainer } from '../../components/ScreenContainer';
import { StatTile } from '../../components/StatTile';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../lib/auth-context';
import { getActiveRoutineForClient } from '../../lib/firestore/routines';
import { createWorkoutLog, getWorkoutLogsForClient } from '../../lib/firestore/workoutLogs';
import { syncMySocialStats } from '../../lib/firestore/social';
import {
  currentStreak,
  detectNewPRs,
  lastPerformanceByExercise,
  sessionTotals,
  type LastPerformance,
  type PersonalRecord,
} from '../../lib/stats';
import { fonts, colors, radius, shadows, spacing, typography } from '../../lib/theme';
import {
  todayWeekday,
  WEEKDAY_NAMES,
  type LoggedExercise,
  type Routine,
  type RoutineDay,
} from '../../lib/types';

const DEFAULT_REST_SECONDS = 90;

function buildLog(day: RoutineDay): LoggedExercise[] {
  return day.exercises.map((ex) => ({
    exerciseId: ex.exerciseId,
    name: ex.name,
    sets: Array.from({ length: ex.sets || 1 }, () => ({
      reps: ex.reps,
      weight: '',
      completed: false,
    })),
  }));
}

interface SessionSummary {
  durationMin: number;
  sets: number;
  reps: number;
  volumeKg: number;
  prs: PersonalRecord[];
  streak: number;
}

export default function WorkoutScreen() {
  const { profile } = useAuth();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [history, setHistory] = useState<import('../../lib/types').WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [log, setLog] = useState<LoggedExercise[]>([]);
  const [lastPerf, setLastPerf] = useState<Record<string, LastPerformance>>({});
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [restKey, setRestKey] = useState(0);
  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  const startedAt = useRef<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      let cancelled = false;
      (async () => {
        const [data, logs] = await Promise.all([
          getActiveRoutineForClient(profile.uid),
          getWorkoutLogsForClient(profile.uid),
        ]);
        if (cancelled) return;
        setRoutine(data);
        setHistory(logs);
        setLastPerf(lastPerformanceByExercise(logs));
        if (data && data.days.length > 0) {
          // Preselecciona el día planificado para hoy; si no hay, el primero.
          const todays = data.days.find((d) => d.weekday === todayWeekday());
          setSelectedDayId((prev) => prev ?? todays?.id ?? data.days[0].id);
        }
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [profile])
  );

  useEffect(() => {
    if (!routine || !selectedDayId) return;
    const day = routine.days.find((d) => d.id === selectedDayId);
    if (day) {
      setLog(buildLog(day));
      setSummary(null);
      setRestSeconds(null);
      startedAt.current = null;
    }
  }, [routine, selectedDayId]);

  const day = routine?.days.find((d) => d.id === selectedDayId) ?? null;

  const updateSet = (
    exerciseIndex: number,
    setIndex: number,
    field: 'reps' | 'weight' | 'completed',
    value: string | boolean
  ) => {
    setLog((prev) =>
      prev.map((ex, i) =>
        i === exerciseIndex
          ? {
              ...ex,
              sets: ex.sets.map((s, j) => (j === setIndex ? { ...s, [field]: value } : s)),
            }
          : ex
      )
    );

    // Al completar una serie: arranca el crono de descanso del ejercicio.
    if (field === 'completed' && value === true) {
      if (!startedAt.current) startedAt.current = Date.now();
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      const rest = day?.exercises[exerciseIndex]?.restSeconds || DEFAULT_REST_SECONDS;
      setRestSeconds(rest);
      setRestKey((k) => k + 1);
    }
  };

  const totalSets = log.reduce((acc, ex) => acc + ex.sets.length, 0);
  const doneSets = log.reduce((acc, ex) => acc + ex.sets.filter((s) => s.completed).length, 0);
  const progress = totalSets > 0 ? doneSets / totalSets : 0;
  // Ejercicio "actual": el primero con series pendientes.
  const currentIndex = log.findIndex((ex) => ex.sets.some((s) => !s.completed));

  const handleSave = async () => {
    if (!profile || !routine || !day) return;
    setSaving(true);
    try {
      const durationMin = startedAt.current
        ? Math.max(1, Math.round((Date.now() - startedAt.current) / 60000))
        : 0;
      const prs = detectNewPRs(history, log);
      const totals = sessionTotals(log);

      await createWorkoutLog({
        trainerId: routine.trainerId,
        clientId: profile.uid,
        routineId: routine.id,
        routineName: routine.name,
        dayName: day.name,
        date: Date.now(),
        exercises: log,
        ...(durationMin > 0 ? { durationMin } : {}),
      });

      const freshLogs = await getWorkoutLogsForClient(profile.uid);
      await syncMySocialStats(profile, freshLogs);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setRestSeconds(null);
      setSummary({
        durationMin,
        ...totals,
        prs,
        streak: currentStreak(freshLogs),
      });
      setHistory(freshLogs);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen />;

  if (!routine || routine.days.length === 0) {
    return (
      <ScreenContainer>
        <Text style={styles.title}>Mi entrenamiento</Text>
        <EmptyState
          title="Sin rutina asignada"
          subtitle="Tu entrenador todavía no te ha asignado una rutina. Vuelve a comprobarlo pronto."
        />
      </ScreenContainer>
    );
  }

  // ---------- Resumen post-entreno ----------
  if (summary) {
    return (
      <ScreenContainer contentStyle={styles.summaryContent}>
        <View style={styles.summaryBadge}>
          <Ionicons name="checkmark" size={44} color={colors.onPrimary} />
        </View>
        <Text style={styles.summaryTitle}>Sesión completada</Text>
        <Text style={styles.summarySubtitle}>
          {routine.name} · {day?.name}
        </Text>

        <View style={styles.summaryTiles}>
          {summary.durationMin > 0 ? (
            <StatTile icon="time" value={`${summary.durationMin} min`} label="Duración" />
          ) : null}
          <StatTile icon="layers" value={`${summary.sets}`} label="Series" />
          <StatTile icon="repeat" value={`${summary.reps}`} label="Reps" />
          {summary.volumeKg > 0 ? (
            <StatTile icon="barbell" value={`${summary.volumeKg} kg`} label="Volumen" />
          ) : null}
        </View>

        {summary.prs.length > 0 ? (
          <Card accent style={styles.prCard}>
            <View style={styles.prHeader}>
              <Ionicons name="trophy" size={18} color={colors.primary} />
              <Text style={styles.prTitle}>
                {summary.prs.length === 1 ? 'Nuevo récord personal' : 'Nuevos récords personales'}
              </Text>
            </View>
            {summary.prs.map((pr) => (
              <View key={pr.exerciseName} style={styles.prRow}>
                <Text style={styles.prExercise}>{pr.exerciseName}</Text>
                <Text style={styles.prLabel}>{pr.label}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {summary.streak > 1 ? (
          <View style={styles.streakRow}>
            <Ionicons name="flame" size={18} color={colors.primary} />
            <Text style={styles.streakText}>Racha de {summary.streak} días. Sigue así.</Text>
          </View>
        ) : null}

        <Button
          title="Volver al entrenamiento"
          variant="secondary"
          onPress={() => {
            if (day) setLog(buildLog(day));
            setSummary(null);
            startedAt.current = null;
          }}
          style={{ marginTop: spacing.lg }}
        />
      </ScreenContainer>
    );
  }

  // ---------- Modo entreno ----------
  return (
    <ScreenContainer>
      <Text style={styles.title}>{routine.name}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayTabs}>
        {routine.days.map((d) => {
          const isToday = d.weekday === todayWeekday();
          return (
            <Pressable
              key={d.id}
              onPress={() => setSelectedDayId(d.id)}
              style={[styles.dayTab, selectedDayId === d.id && styles.dayTabSelected]}
            >
              <Text
                style={[styles.dayTabText, selectedDayId === d.id && styles.dayTabTextSelected]}
              >
                {d.weekday !== undefined ? `${WEEKDAY_NAMES[d.weekday].slice(0, 3)} · ` : ''}
                {d.name}
                {isToday ? '  ·  HOY' : ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {totalSets > 0 ? (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(progress * 100, 1)}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {doneSets}/{totalSets} series
          </Text>
        </View>
      ) : null}

      {restSeconds !== null ? (
        <RestTimer key={restKey} seconds={restSeconds} onDone={() => setRestSeconds(null)} />
      ) : null}

      {log.map((exercise, exerciseIndex) => {
        const prev = lastPerf[exercise.exerciseId];
        const isCurrent = exerciseIndex === currentIndex;
        const isDone = exercise.sets.length > 0 && exercise.sets.every((s) => s.completed);
        return (
          <Card
            key={exercise.exerciseId + exerciseIndex}
            accent={isCurrent}
            style={[styles.exerciseCard, isDone && styles.exerciseCardDone]}
          >
            <View style={styles.exerciseHeader}>
              <Text style={[styles.exerciseName, isCurrent && styles.exerciseNameCurrent]}>
                {exercise.name}
              </Text>
              {isDone ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              ) : isCurrent ? (
                <View style={styles.nowChip}>
                  <Text style={styles.nowChipText}>AHORA</Text>
                </View>
              ) : null}
            </View>
            {prev ? (
              <View style={styles.prevRow}>
                <Ionicons name="time-outline" size={13} color={colors.primary} />
                <Text style={styles.prevText}>
                  Última vez: {prev.weight ? `${prev.weight} kg × ` : ''}
                  {prev.reps ?? '—'} reps
                </Text>
              </View>
            ) : null}
            {exercise.sets.map((set, setIndex) => (
              <View key={setIndex} style={styles.setRow}>
                <Text style={styles.setLabel}>Serie {setIndex + 1}</Text>
                <TextField
                  value={set.reps}
                  onChangeText={(v) => updateSet(exerciseIndex, setIndex, 'reps', v)}
                  placeholder="Reps"
                  style={styles.setInput}
                />
                <TextField
                  value={set.weight}
                  onChangeText={(v) => updateSet(exerciseIndex, setIndex, 'weight', v)}
                  placeholder="Peso (kg)"
                  keyboardType="numeric"
                  style={styles.setInput}
                />
                <Pressable
                  onPress={() => updateSet(exerciseIndex, setIndex, 'completed', !set.completed)}
                  style={[styles.checkButton, set.completed && styles.checkButtonDone]}
                  hitSlop={6}
                >
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={set.completed ? colors.onPrimary : colors.textFaint}
                  />
                </Pressable>
              </View>
            ))}
          </Card>
        );
      })}

      <Button
        title="Marcar sesión como completada"
        onPress={handleSave}
        loading={saving}
        disabled={doneSets === 0}
        style={{ marginBottom: spacing.xl }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.md },
  dayTabs: { marginBottom: spacing.md },
  dayTab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  dayTabSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayTabText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  dayTabTextSelected: { color: colors.onPrimary },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  progressText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  exerciseCard: { marginBottom: spacing.md },
  exerciseCardDone: { opacity: 0.55 },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  exerciseName: { ...typography.h3, color: colors.text, flex: 1 },
  exerciseNameCurrent: { color: colors.primaryBright },
  nowChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  nowChipText: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    letterSpacing: 1.2,
    color: colors.primaryBright,
  },
  prevRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  prevText: { ...typography.small, color: colors.primary, fontFamily: fonts.medium },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  setLabel: { ...typography.small, color: colors.textMuted, width: 56 },
  setInput: { flex: 1, marginBottom: 0 },
  checkButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  checkButtonDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  // ----- Resumen -----
  summaryContent: { flexGrow: 1, justifyContent: 'center' },
  summaryBadge: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
    ...shadows.glowGold,
  },
  summaryTitle: {
    ...typography.h1,
    color: colors.text,
    textAlign: 'center',
  },
  summarySubtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  summaryTiles: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  prCard: { marginBottom: spacing.md },
  prHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  prTitle: { ...typography.h3, color: colors.primaryBright },
  prRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  prExercise: { ...typography.body, color: colors.text },
  prLabel: { ...typography.body, color: colors.primary, fontFamily: fonts.semiBold },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  streakText: { ...typography.body, color: colors.textMuted },
});
