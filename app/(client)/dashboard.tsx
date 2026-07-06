import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { Card } from '../../components/Card';
import { CheckInCard } from '../../components/CheckInCard';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ScreenContainer } from '../../components/ScreenContainer';
import { StatTile } from '../../components/StatTile';
import { useAuth } from '../../lib/auth-context';
import { getActiveRoutineForClient } from '../../lib/firestore/routines';
import { getAnnouncementsForTrainer } from '../../lib/firestore/announcements';
import { getCheckInsForClient, hasCheckInThisWeek } from '../../lib/firestore/checkins';
import {
  getHabitLogsForClient,
  getHabitsForClient,
  logHabitToday,
  todayStart,
  unlogHabit,
} from '../../lib/firestore/habits';
import { getWeightLogsForClient } from '../../lib/firestore/weightLogs';
import { getWorkoutLogsForClient } from '../../lib/firestore/workoutLogs';
import { currentStreak, sessionsThisWeek as weekSessions } from '../../lib/stats';
import { fonts, colors, radius, spacing, typography } from '../../lib/theme';
import {
  todayWeekday,
  WEEKDAY_NAMES,
  type Announcement,
  type Habit,
  type HabitLog,
  type Routine,
  type WeightLog,
  type WorkoutLog,
} from '../../lib/types';

const WEIGHT_REMINDER_DAYS = 7;

export default function ClientDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [needsCheckIn, setNeedsCheckIn] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      let cancelled = false;
      (async () => {
        const [routineData, weightData, workoutData, checkIns, announcementData, habitData, habitLogData] =
          await Promise.all([
            getActiveRoutineForClient(profile.uid),
            getWeightLogsForClient(profile.uid),
            getWorkoutLogsForClient(profile.uid),
            getCheckInsForClient(profile.uid),
            profile.trainerId ? getAnnouncementsForTrainer(profile.trainerId) : Promise.resolve([]),
            getHabitsForClient(profile.uid),
            getHabitLogsForClient(profile.uid),
          ]);
        if (cancelled) return;
        setRoutine(routineData);
        setWeightLogs(weightData);
        setWorkoutLogs(workoutData);
        setNeedsCheckIn(!hasCheckInThisWeek(checkIns));
        setAnnouncements(announcementData);
        setHabits(habitData);
        setHabitLogs(habitLogData);
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [profile])
  );

  if (loading) return <LoadingScreen />;

  const currentWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weightKg : null;
  const sessions = weekSessions(workoutLogs);
  const streak = currentStreak(workoutLogs);
  // Día planificado para hoy (si el entrenador asignó días de la semana);
  // si no, el primero de la rutina.
  const todaysDay = routine?.days.find((d) => d.weekday === todayWeekday());
  const restDay = Boolean(
    routine && !todaysDay && routine.days.some((d) => d.weekday !== undefined)
  );
  const nextDay = todaysDay ?? routine?.days[0];

  const lastWeightLog = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1] : null;
  const daysSinceWeight = lastWeightLog
    ? (Date.now() - lastWeightLog.date) / (1000 * 60 * 60 * 24)
    : Infinity;
  const showWeightReminder = daysSinceWeight > WEIGHT_REMINDER_DAYS;

  const today = todayStart();
  const todayLogByHabit = new Map(
    habitLogs.filter((l) => l.day === today).map((l) => [l.habitId, l])
  );

  const toggleHabit = async (habit: Habit) => {
    const existing = todayLogByHabit.get(habit.id);
    if (existing) {
      setHabitLogs((prev) => prev.filter((l) => l.id !== existing.id));
      await unlogHabit(existing.id);
    } else {
      const optimistic: HabitLog = {
        id: `tmp-${habit.id}`,
        trainerId: habit.trainerId,
        clientId: habit.clientId,
        habitId: habit.id,
        day: today,
        createdAt: Date.now(),
      };
      setHabitLogs((prev) => [...prev, optimistic]);
      const newId = await logHabitToday({
        trainerId: habit.trainerId,
        clientId: habit.clientId,
        habitId: habit.id,
      });
      setHabitLogs((prev) =>
        prev.map((l) => (l.id === optimistic.id ? { ...l, id: newId } : l))
      );
    }
  };

  const targetSessions = routine?.days.length ?? 0;
  const weekProgress = targetSessions > 0 ? Math.min(sessions / targetSessions, 1) : 0;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greetingLabel}>Bienvenido de nuevo</Text>
          <Text style={styles.greeting}>{profile?.name?.split(' ')[0]}</Text>
        </View>
        <Pressable onPress={() => router.push('/(client)/profile')}>
          <Avatar name={profile?.name} photoURL={profile?.photoURL} size={52} />
        </Pressable>
      </View>

      {showWeightReminder ? (
        <Pressable onPress={() => router.push('/(client)/progress')}>
          <View style={styles.reminderBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
            <Text style={styles.reminderText}>
              {lastWeightLog
                ? 'Llevas más de una semana sin registrar tu peso.'
                : 'Todavía no has registrado tu peso. Empieza tu seguimiento.'}
            </Text>
          </View>
        </Pressable>
      ) : null}

      {announcements.length > 0 ? (
        <Card accent style={styles.section}>
          <View style={styles.announceHeader}>
            <Ionicons name="megaphone-outline" size={16} color={colors.primary} />
            <Text style={styles.sectionLabel}>Anuncios del coach</Text>
          </View>
          {announcements.slice(0, 2).map((a) => (
            <View key={a.id} style={styles.announceRow}>
              <Text style={styles.announceTitle}>{a.title}</Text>
              {a.body ? <Text style={styles.announceBody}>{a.body}</Text> : null}
              <Text style={styles.announceDate}>
                {new Date(a.createdAt).toLocaleDateString('es-ES')}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      {needsCheckIn && profile ? (
        <CheckInCard profile={profile} onDone={() => setNeedsCheckIn(false)} />
      ) : null}

      {habits.length > 0 ? (
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>Hábitos de hoy</Text>
          {habits.map((h) => {
            const done = todayLogByHabit.has(h.id);
            return (
              <Pressable key={h.id} onPress={() => toggleHabit(h)} style={styles.habitRow}>
                <View style={[styles.habitCheck, done && styles.habitCheckDone]}>
                  {done ? (
                    <Ionicons name="checkmark" size={14} color={colors.onPrimary} />
                  ) : null}
                </View>
                <Text style={[styles.habitName, done && styles.habitNameDone]}>{h.name}</Text>
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      <View style={styles.statsRow}>
        <StatTile icon="flame" value={String(streak)} label="Racha (días)" highlight={streak > 0} />
        <StatTile icon="checkmark-done" value={String(sessions)} label="Esta semana" />
        <StatTile
          icon="body"
          value={currentWeight ? `${currentWeight}` : '—'}
          label="Peso (kg)"
        />
      </View>

      <Pressable onPress={() => router.push('/(client)/workout')}>
        <Card style={styles.nextCard}>
          <View style={styles.nextHeader}>
            <Text style={styles.sectionLabel}>
              {todaysDay ? 'Hoy toca' : 'Próximo entrenamiento'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </View>
          {routine && restDay ? (
            <>
              <Text style={styles.routineName}>Descanso</Text>
              <Text style={styles.routineMeta}>
                Hoy ({WEEKDAY_NAMES[todayWeekday()]}) no tienes sesión planificada. Recupera:
                también es entrenar.
              </Text>
            </>
          ) : routine && nextDay ? (
            <>
              <Text style={styles.routineName}>{nextDay.name}</Text>
              <Text style={styles.routineMeta}>
                {routine.name} · {nextDay.exercises.length} ejercicios
                {todaysDay ? ` · ${WEEKDAY_NAMES[todayWeekday()]}` : ''}
              </Text>
              <View style={styles.ctaRow}>
                <Ionicons name="play-circle" size={20} color={colors.primary} />
                <Text style={styles.ctaText}>Empezar sesión</Text>
              </View>
            </>
          ) : (
            <Text style={styles.mutedText}>
              Tu entrenador todavía no te ha asignado una rutina.
            </Text>
          )}
        </Card>
      </Pressable>

      <Card style={styles.section}>
        <Text style={styles.sectionLabel}>Objetivo semanal</Text>
        {targetSessions > 0 ? (
          <>
            <View style={styles.progressHeader}>
              <Text style={styles.progressValue}>
                {sessions} / {targetSessions} sesiones
              </Text>
              <Text style={styles.progressPct}>{Math.round(weekProgress * 100)}%</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${weekProgress * 100}%` }]} />
            </View>
            <Text style={styles.mutedText}>
              {sessions >= targetSessions
                ? '¡Objetivo de la semana cumplido! Sigue así.'
                : `Te faltan ${targetSessions - sessions} sesión(es) para completar la semana.`}
            </Text>
          </>
        ) : (
          <Text style={styles.mutedText}>
            Cuando tengas una rutina asignada, aquí verás tu objetivo semanal.
          </Text>
        )}
      </Card>

      {profile?.goal ? (
        <Card style={styles.section}>
          <Text style={styles.sectionLabel}>Mi objetivo</Text>
          <Text style={styles.goalText}>{profile.goal}</Text>
        </Card>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  greetingLabel: { ...typography.label, color: colors.primary, textTransform: 'uppercase' },
  greeting: { ...typography.h1, color: colors.text, marginTop: 2 },
  reminderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerMuted,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  reminderText: { ...typography.small, color: colors.warning, fontFamily: fonts.semiBold, flex: 1 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  nextCard: { marginBottom: spacing.md },
  nextHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionLabel: { ...typography.label, color: colors.textMuted, textTransform: 'uppercase' },
  routineName: { ...typography.h2, color: colors.text },
  routineMeta: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  ctaText: { ...typography.body, color: colors.primary, fontFamily: fonts.semiBold },
  section: { marginBottom: spacing.md },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  progressValue: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  progressPct: { ...typography.body, color: colors.primary, fontFamily: fonts.heading },
  track: {
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  fill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },
  goalText: { ...typography.body, color: colors.text, marginTop: spacing.xs },
  mutedText: { ...typography.small, color: colors.textMuted },
  announceHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  announceRow: {
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  announceTitle: { ...typography.h3, color: colors.text },
  announceBody: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  announceDate: { ...typography.small, color: colors.textFaint, marginTop: 2, fontSize: 11 },
  habitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  habitCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitCheckDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  habitName: { ...typography.body, color: colors.text },
  habitNameDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
});
