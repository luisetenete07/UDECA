import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/Card';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ScreenContainer } from '../../components/ScreenContainer';
import { useAuth } from '../../lib/auth-context';
import { getActiveRoutineForClient } from '../../lib/firestore/routines';
import { getWeightLogsForClient } from '../../lib/firestore/weightLogs';
import { getWorkoutLogsForClient } from '../../lib/firestore/workoutLogs';
import { colors, radius, spacing, typography } from '../../lib/theme';
import type { Routine, WeightLog, WorkoutLog } from '../../lib/types';

const WEIGHT_REMINDER_DAYS = 7;

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay() === 0 ? 7 : d.getDay();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day + 1);
  return d.getTime();
}

export default function ClientDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      let cancelled = false;
      (async () => {
        const [routineData, weightData, workoutData] = await Promise.all([
          getActiveRoutineForClient(profile.uid),
          getWeightLogsForClient(profile.uid),
          getWorkoutLogsForClient(profile.uid),
        ]);
        if (cancelled) return;
        setRoutine(routineData);
        setWeightLogs(weightData);
        setWorkoutLogs(workoutData);
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [profile])
  );

  if (loading) return <LoadingScreen />;

  const currentWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weightKg : null;
  const weekStart = startOfWeek(new Date());
  const sessionsThisWeek = workoutLogs.filter((log) => log.date >= weekStart).length;
  const nextDay = routine?.days[0];

  const lastWeightLog = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1] : null;
  const daysSinceWeight = lastWeightLog
    ? (Date.now() - lastWeightLog.date) / (1000 * 60 * 60 * 24)
    : Infinity;
  const showWeightReminder = daysSinceWeight > WEIGHT_REMINDER_DAYS;

  return (
    <ScreenContainer>
      <Text style={styles.greeting}>Hola, {profile?.name?.split(' ')[0]}</Text>
      <Text style={styles.subtitle}>{profile?.goal || 'Define tu objetivo con tu entrenador'}</Text>

      {showWeightReminder ? (
        <Pressable onPress={() => router.push('/(client)/progress')}>
          <View style={styles.reminderBanner}>
            <Text style={styles.reminderText}>
              {lastWeightLog
                ? 'Llevas más de una semana sin registrar tu peso. Toca para añadirlo.'
                : 'Todavía no has registrado tu peso. Toca para empezar tu seguimiento.'}
            </Text>
          </View>
        </Pressable>
      ) : null}

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{currentWeight ? `${currentWeight} kg` : '—'}</Text>
          <Text style={styles.statLabel}>Peso actual</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{sessionsThisWeek}</Text>
          <Text style={styles.statLabel}>Entrenos esta semana</Text>
        </Card>
      </View>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Próximo entrenamiento</Text>
        {routine && nextDay ? (
          <>
            <Text style={styles.routineName}>{routine.name}</Text>
            <Text style={styles.dayName}>{nextDay.name}</Text>
            <Text style={styles.mutedText}>{nextDay.exercises.length} ejercicios</Text>
          </>
        ) : (
          <Text style={styles.mutedText}>
            Tu entrenador todavía no te ha asignado una rutina.
          </Text>
        )}
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Resumen semanal</Text>
        <Text style={styles.mutedText}>
          Has completado {sessionsThisWeek} sesión(es) esta semana
          {routine ? ` de ${routine.days.length} planificadas` : ''}.
        </Text>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  greeting: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  reminderBanner: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  reminderText: { ...typography.small, color: colors.warning, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  statValue: { ...typography.h1, color: colors.primary },
  statLabel: { ...typography.small, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  section: { marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  routineName: { ...typography.body, color: colors.text, fontWeight: '700' },
  dayName: { ...typography.body, color: colors.primary, marginTop: 2 },
  mutedText: { ...typography.small, color: colors.textMuted },
});
