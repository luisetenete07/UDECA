import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '../../components/Avatar';
import { Card } from '../../components/Card';
import { CheckInCard } from '../../components/CheckInCard';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ProgressBar } from '../../components/ProgressBar';
import { ScreenContainer } from '../../components/ScreenContainer';
import { StatTile } from '../../components/StatTile';
import { WeekStrip } from '../../components/WeekStrip';
import { useAuth } from '../../lib/auth-context';
import { getActiveRoutineForClient } from '../../lib/firestore/routines';
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
import { quoteOfTheDay } from '../../lib/quotes';
import { flushPendingWorkouts } from '../../lib/offlineQueue';
import { getCached, setCached } from '../../lib/screenCache';
import { currentStreak, sessionsThisWeek as weekSessions, trainingDays } from '../../lib/stats';
import { resolveTodaySession } from '../../lib/schedule';
import { getCycleAnchor } from '../../lib/cycleAnchor';
import { fonts, colors, gradients, radius, shadows, spacing, typography } from '../../lib/theme';
import {
  todayWeekday,
  WEEKDAY_NAMES,
  type Habit,
  type HabitLog,
  type Routine,
  type WeightLog,
  type WorkoutLog,
} from '../../lib/types';

const WEIGHT_REMINDER_DAYS = 7;

interface ClientDashData {
  routine: Routine | null;
  weightLogs: WeightLog[];
  workoutLogs: WorkoutLog[];
  needsCheckIn: boolean;
  hasAnyCheckIn: boolean;
  habits: Habit[];
  habitLogs: HabitLog[];
  cycleAnchor: number | null;
}

export default function ClientDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  // Pinta al instante lo último conocido (caché de sesión) y refresca detrás.
  const cacheKey = `client-dash-${profile?.uid ?? ''}`;
  const cached = getCached<ClientDashData>(cacheKey);
  const [routine, setRoutine] = useState<Routine | null>(cached?.routine ?? null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>(cached?.weightLogs ?? []);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>(cached?.workoutLogs ?? []);
  const [needsCheckIn, setNeedsCheckIn] = useState(cached?.needsCheckIn ?? false);
  const [hasAnyCheckIn, setHasAnyCheckIn] = useState(cached?.hasAnyCheckIn ?? true);
  const [habits, setHabits] = useState<Habit[]>(cached?.habits ?? []);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>(cached?.habitLogs ?? []);
  const [cycleAnchor, setCycleAnchor] = useState<number | null>(cached?.cycleAnchor ?? null);
  const [loading, setLoading] = useState(cached === undefined);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isActive?: () => boolean) => {
      if (!profile) return;
      // Sube entrenos que quedaron pendientes por falta de conexión.
      await flushPendingWorkouts().catch(() => {});
      const [routineData, weightData, workoutData, checkIns, habitData, habitLogData] =
        await Promise.all([
          getActiveRoutineForClient(profile.uid),
          getWeightLogsForClient(profile.uid),
          getWorkoutLogsForClient(profile.uid),
          getCheckInsForClient(profile.uid),
          getHabitsForClient(profile.uid),
          getHabitLogsForClient(profile.uid),
        ]);
      const anchor = routineData ? await getCycleAnchor(routineData.id) : null;
      if (isActive && !isActive()) return;
      setCycleAnchor(anchor);
      setRoutine(routineData);
      setWeightLogs(weightData);
      setWorkoutLogs(workoutData);
      setNeedsCheckIn(!hasCheckInThisWeek(checkIns));
      setHasAnyCheckIn(checkIns.length > 0);
      setHabits(habitData);
      setHabitLogs(habitLogData);
      setCached(cacheKey, {
        routine: routineData,
        weightLogs: weightData,
        workoutLogs: workoutData,
        needsCheckIn: !hasCheckInThisWeek(checkIns),
        hasAnyCheckIn: checkIns.length > 0,
        habits: habitData,
        habitLogs: habitLogData,
        cycleAnchor: anchor,
      } satisfies ClientDashData);
      setLoading(false);
      setRefreshing(false);
    },
    [profile, cacheKey]
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      load(() => active).catch(() => {
        setLoading(false);
        setRefreshing(false);
      });
      return () => {
        active = false;
      };
    }, [load])
  );

  if (loading) return <LoadingScreen />;

  const currentWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weightKg : null;
  const sessions = weekSessions(workoutLogs);
  const streak = currentStreak(workoutLogs);
  // Qué toca hoy según el modo (semanal o Método REIN TENA por ciclo).
  const todaySession = resolveTodaySession(routine, cycleAnchor ?? undefined);
  const todaysDay = todaySession.day;
  const restDay = todaySession.isRest;
  const optionalRest = todaySession.optionalRest;
  const nextDay = todaySession.day;
  const isCycle = routine?.schedule === 'cycle';

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

  // Checklist de bienvenida: se oculta cuando está todo completado.
  const firstSteps = [
    { key: 'photo', label: 'Sube tu foto de perfil', done: Boolean(profile?.photoURL), go: '/(client)/profile' },
    { key: 'weight', label: 'Registra tu peso inicial', done: weightLogs.length > 0, go: '/(client)/progress' },
    { key: 'workout', label: 'Completa tu primer entrenamiento', done: workoutLogs.length > 0, go: '/(client)/workout' },
    { key: 'checkin', label: 'Envía tu primer check-in', done: hasAnyCheckIn, go: null },
  ] as const;
  const showFirstSteps = firstSteps.some((s) => !s.done);
  const stepsDone = firstSteps.filter((s) => s.done).length;

  return (
    <ScreenContainer
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greetingLabel}>Bienvenido de nuevo</Text>
          <Text style={styles.greeting}>{profile?.name?.split(' ')[0]}</Text>
        </View>
        <Pressable onPress={() => router.push('/(client)/profile')}>
          <Avatar name={profile?.name} photoURL={profile?.photoURL} size={52} />
        </Pressable>
      </View>

      <View style={styles.quoteWrap}>
        <View style={styles.quoteRule} />
        <Text style={styles.quoteText}>{quoteOfTheDay()}</Text>
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

      {/* Acción principal del día */}
      <Pressable onPress={() => router.push('/(client)/workout')}>
        <LinearGradient
          colors={gradients.goldSubtle}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.todayCard}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.todayLabel}>
              {isCycle
                ? `REIN TENA · ${todaySession.cycleLabel ?? ''}${
                    todaySession.day?.intensity ? ` · Int. ${todaySession.day.intensity}/10` : ''
                  }`
                : todaysDay
                  ? `Hoy · ${WEEKDAY_NAMES[todayWeekday()]}`
                  : 'Tu entrenamiento'}
            </Text>
            {routine && optionalRest ? (
              <>
                <Text style={styles.todayTitle}>Descanso opcional</Text>
                <Text style={styles.todaySub}>
                  Tú eliges: descansar o reiniciar el ciclo en el Día 1. Entra para decidir.
                </Text>
              </>
            ) : routine && restDay ? (
              <>
                <Text style={styles.todayTitle}>Día de descanso</Text>
                <Text style={styles.todaySub}>Hoy no toca sesión. Recupera y vuelve con todo.</Text>
              </>
            ) : routine && nextDay ? (
              <>
                <Text style={styles.todayTitle}>{nextDay.name}</Text>
                <Text style={styles.todaySub}>
                  {nextDay.exercises.length} ejercicios · Empezar sesión
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.todayTitle}>Sin rutina aún</Text>
                <Text style={styles.todaySub}>Tu entrenador te la asignará pronto.</Text>
              </>
            )}
          </View>
          <View style={routine && !restDay && nextDay ? styles.todayPlay : styles.todayRest}>
            <Ionicons
              name={routine && !restDay && nextDay ? 'play' : 'bed-outline'}
              size={routine && !restDay && nextDay ? 26 : 24}
              color={routine && !restDay && nextDay ? colors.onPrimary : colors.primaryBright}
            />
          </View>
        </LinearGradient>
      </Pressable>

      {/* Plan semanal: tira de días + objetivo, todo junto y ordenado */}
      <Card style={styles.section}>
        <View style={styles.weekHeader}>
          <Text style={styles.sectionLabel}>Tu semana</Text>
          {targetSessions > 0 ? (
            <Text style={styles.weekCount}>
              {sessions}/{targetSessions} sesiones
            </Text>
          ) : null}
        </View>

        <WeekStrip routine={routine} trainedDays={trainingDays(workoutLogs)} />

        {targetSessions > 0 ? (
          <>
            <View style={{ marginTop: spacing.xs, marginBottom: spacing.sm }}>
              <ProgressBar progress={weekProgress} height={8} />
            </View>
            <Text style={styles.weekHint}>
              {sessions >= targetSessions
                ? '¡Objetivo de la semana cumplido! 🔥'
                : `Te faltan ${targetSessions - sessions} sesión(es) para cumplir tu semana.`}
            </Text>
          </>
        ) : (
          <Text style={styles.weekHint}>
            Cuando tengas rutina asignada verás aquí tu plan y objetivo semanal.
          </Text>
        )}

        <View style={styles.weekLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendDone]} />
            <Text style={styles.legendText}>Hecho</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendPlanned]} />
            <Text style={styles.legendText}>Planificado</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendTodayDot]} />
            <Text style={styles.legendText}>Hoy</Text>
          </View>
        </View>
      </Card>

      <View style={styles.statsRow}>
        <StatTile icon="flame" value={String(streak)} label="Racha (días)" highlight={streak > 0} />
        <StatTile icon="checkmark-done" value={String(sessions)} label="Esta semana" />
        <StatTile
          icon="body"
          value={currentWeight != null ? currentWeight.toLocaleString('es-ES') : '—'}
          label="Peso (kg)"
        />
      </View>

      {showFirstSteps ? (
        <Card accent style={styles.section}>
          <View style={styles.firstStepsHeader}>
            <Text style={styles.sectionLabel}>Primeros pasos</Text>
            <Text style={styles.firstStepsCount}>
              {stepsDone}/{firstSteps.length}
            </Text>
          </View>
          <View style={{ marginBottom: spacing.sm }}>
            <ProgressBar progress={stepsDone / firstSteps.length} height={5} />
          </View>
          {firstSteps.map((step) => (
            <Pressable
              key={step.key}
              onPress={() => {
                if (!step.done && step.go) router.push(step.go);
              }}
              style={styles.firstStepRow}
            >
              <View style={[styles.stepCheck, step.done && styles.stepCheckDone]}>
                {step.done ? (
                  <Ionicons name="checkmark" size={12} color={colors.onPrimary} />
                ) : null}
              </View>
              <Text style={[styles.stepLabel, step.done && styles.stepLabelDone]}>
                {step.label}
              </Text>
              {!step.done && step.go ? (
                <Ionicons name="chevron-forward" size={14} color={colors.textFaint} />
              ) : null}
            </Pressable>
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
  quoteWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingRight: spacing.md,
  },
  quoteRule: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: colors.primary },
  quoteText: {
    ...typography.body,
    color: colors.textMuted,
    fontStyle: 'italic',
    flex: 1,
    lineHeight: 21,
  },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  sectionLabel: { ...typography.label, color: colors.textMuted, textTransform: 'uppercase' },
  section: { marginBottom: spacing.md },
  // ----- Hero "Hoy toca" -----
  todayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  todayLabel: {
    ...typography.label,
    color: colors.primaryBright,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  todayTitle: { ...typography.h1, color: colors.text, fontSize: 24 },
  todaySub: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  todayPlay: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.glowGold,
  },
  todayRest: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ----- Tarjeta "Tu semana" -----
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  weekCount: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold },
  weekHint: { ...typography.small, color: colors.textMuted },
  weekLegend: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  legendDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  legendPlanned: { backgroundColor: colors.surfaceAlt, borderColor: colors.hairline },
  legendTodayDot: { backgroundColor: colors.surfaceAlt, borderColor: colors.primaryBright, borderWidth: 2 },
  legendText: { ...typography.small, color: colors.textMuted, fontSize: 11 },
  goalText: { ...typography.body, color: colors.text, marginTop: spacing.xs },
  mutedText: { ...typography.small, color: colors.textMuted },
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
  firstStepsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  firstStepsCount: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold },
  firstStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  stepCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCheckDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepLabel: { ...typography.body, color: colors.text, flex: 1 },
  stepLabelDone: { color: colors.textFaint, textDecorationLine: 'line-through' },
});
