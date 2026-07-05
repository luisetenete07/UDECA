import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../lib/auth-context';
import { getActiveRoutineForClient } from '../../lib/firestore/routines';
import { createWorkoutLog, getWorkoutLogsForClient } from '../../lib/firestore/workoutLogs';
import { syncMySocialStats } from '../../lib/firestore/social';
import { lastPerformanceByExercise, type LastPerformance } from '../../lib/stats';
import { fonts, colors, radius, spacing, typography } from '../../lib/theme';
import type { LoggedExercise, Routine, RoutineDay } from '../../lib/types';

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

export default function WorkoutScreen() {
  const { profile } = useAuth();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [log, setLog] = useState<LoggedExercise[]>([]);
  const [lastPerf, setLastPerf] = useState<Record<string, LastPerformance>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      let cancelled = false;
      (async () => {
        const [data, history] = await Promise.all([
          getActiveRoutineForClient(profile.uid),
          getWorkoutLogsForClient(profile.uid),
        ]);
        if (cancelled) return;
        setRoutine(data);
        setLastPerf(lastPerformanceByExercise(history));
        if (data && data.days.length > 0) {
          setSelectedDayId((prev) => prev ?? data.days[0].id);
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
      setSaved(false);
    }
  }, [routine, selectedDayId]);

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
  };

  const handleSave = async () => {
    if (!profile || !routine || !selectedDayId) return;
    const day = routine.days.find((d) => d.id === selectedDayId);
    if (!day) return;
    setSaving(true);
    try {
      await createWorkoutLog({
        trainerId: routine.trainerId,
        clientId: profile.uid,
        routineId: routine.id,
        routineName: routine.name,
        dayName: day.name,
        date: Date.now(),
        exercises: log,
      });
      // Actualiza el ranking social con las nuevas métricas.
      const freshLogs = await getWorkoutLogsForClient(profile.uid);
      await syncMySocialStats(profile, freshLogs);
      setSaved(true);
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

  return (
    <ScreenContainer>
      <Text style={styles.title}>{routine.name}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayTabs}>
        {routine.days.map((day) => (
          <Pressable
            key={day.id}
            onPress={() => setSelectedDayId(day.id)}
            style={[styles.dayTab, selectedDayId === day.id && styles.dayTabSelected]}
          >
            <Text
              style={[styles.dayTabText, selectedDayId === day.id && styles.dayTabTextSelected]}
            >
              {day.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {log.map((exercise, exerciseIndex) => {
        const prev = lastPerf[exercise.exerciseId];
        return (
        <Card key={exercise.exerciseId + exerciseIndex} style={styles.exerciseCard}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
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
              <Switch
                value={set.completed}
                onValueChange={(v) => updateSet(exerciseIndex, setIndex, 'completed', v)}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
          ))}
        </Card>
        );
      })}

      {saved ? (
        <View style={styles.savedRow}>
          <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
          <Text style={styles.savedText}>Entrenamiento registrado</Text>
        </View>
      ) : null}

      <Button
        title="Marcar sesión como completada"
        onPress={handleSave}
        loading={saving}
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
  dayTabText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold, },
  dayTabTextSelected: { color: colors.onPrimary },
  exerciseCard: { marginBottom: spacing.md },
  exerciseName: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
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
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  savedText: {
    ...typography.body,
    color: colors.primary,
    fontFamily: fonts.semiBold, },
});
