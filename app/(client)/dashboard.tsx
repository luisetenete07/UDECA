import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { flexLabel, resolveTodaySession } from '../../lib/schedule';
import { getCyclesForClientSelf } from '../../lib/firestore/cycles';
import { getUserProfile, reportClientPayment } from '../../lib/firestore/users';
import { createCoachCheckoutUrl } from '../../lib/connect';
import { notifyUser } from '../../lib/notifications';
import { showToast } from '../../components/Toast';
import { activeCycle, computeCycleStats, cycleWeekInfo } from '../../lib/cycleStats';
import { getCycleAnchor } from '../../lib/cycleAnchor';
import { fonts, colors, gradients, radius, shadows, spacing, typography } from '../../lib/theme';
import {
  CYCLE_LEVEL_LABEL,
  todayWeekday,
  WEEKDAY_NAMES,
  type Habit,
  type HabitLog,
  type Routine,
  type TrainingCycle,
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

/**
 * Enlace de pago listo para abrir. Si es un enlace de Stripe, le añade el
 * client_reference_id (uid del alumno) para que el webhook sepa QUIÉN pagó y
 * confirme el cobro automáticamente. Otros enlaces (Bizum/PayPal) se abren tal cual.
 */
function buildPayUrl(link: string, clientId: string): string {
  if (!clientId || !/stripe\.com/i.test(link)) return link;
  const sep = link.includes('?') ? '&' : '?';
  return `${link}${sep}client_reference_id=${encodeURIComponent(clientId)}`;
}

export default function ClientDashboard() {
  const { profile, refreshProfile } = useAuth();
  const [reporting, setReporting] = useState(false);
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
  // Petición de valoración en Play Store: una sola vez, tras coger ritmo.
  const [rateDismissed, setRateDismissed] = useState(true);
  // Ciclo en curso (si el coach usa planificación). Best-effort: si las reglas
  // de ciclos aún no están publicadas, la consulta falla en silencio y no se
  // muestra la tarjeta — nunca rompe el resto del inicio.
  const [activeCyc, setActiveCyc] = useState<TrainingCycle | null>(null);
  const [trainerPayLink, setTrainerPayLink] = useState<string | null>(null);
  // Cobros del coach por Stripe Connect (directo, sin comisión de UDECA).
  const [trainerConnect, setTrainerConnect] = useState(false);
  const [payingConnect, setPayingConnect] = useState(false);

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

  // Ciclo en curso (best-effort). Si las reglas de ciclos aún no están
  // publicadas, la consulta falla en silencio y no se muestra la tarjeta.
  useEffect(() => {
    if (!profile) return;
    getCyclesForClientSelf(profile.uid)
      .then((cs) => setActiveCyc(activeCycle(cs)))
      .catch(() => {});
  }, [profile]);

  // Enlace de cobro del entrenador (para el botón "Pagar ahora" del alumno).
  useEffect(() => {
    if (!profile?.trainerId) return;
    getUserProfile(profile.trainerId)
      .then((t) => {
        setTrainerPayLink(t?.paymentLink ?? null);
        setTrainerConnect(Boolean(t?.stripeChargesEnabled));
      })
      .catch(() => {});
  }, [profile?.trainerId]);

  // ¿Mostrar la petición de valoración? Solo si no se ha pedido/valorado antes.
  useEffect(() => {
    if (!profile) return;
    AsyncStorage.getItem(`udeca-rate-${profile.uid}`)
      .then((v) => setRateDismissed(v === '1'))
      .catch(() => setRateDismissed(true));
  }, [profile]);

  const closeRate = (rated: boolean) => {
    setRateDismissed(true);
    if (profile) AsyncStorage.setItem(`udeca-rate-${profile.uid}`, '1').catch(() => {});
    if (rated) {
      const url =
        Platform.OS === 'android'
          ? 'market://details?id=entrenadores.app'
          : 'https://play.google.com/store/apps/details?id=entrenadores.app';
      Linking.openURL(url).catch(() =>
        Linking.openURL(
          'https://play.google.com/store/apps/details?id=entrenadores.app'
        ).catch(() => {})
      );
    }
  };

  if (loading) return <LoadingScreen />;

  // Atleta individual: se autoentrena (sin coach). Cambia el tono de varias
  // tarjetas para que todo hable de "tú" en lugar de "tu entrenador".
  const isAthlete = profile?.role === 'athlete';
  const currentWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weightKg : null;
  const sessions = weekSessions(workoutLogs);
  const streak = currentStreak(workoutLogs, {
    routine,
    cycleAnchor,
    restDays: profile?.flexRestDays,
  });
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

  // Checklist de bienvenida: se oculta cuando está todo completado. Para el
  // atleta, el último paso es crear su propio plan (no hay check-in de coach).
  const firstSteps = [
    { key: 'photo', label: 'Sube tu foto de perfil', done: Boolean(profile?.photoURL), go: '/(client)/profile' as const },
    { key: 'weight', label: 'Registra tu peso inicial', done: weightLogs.length > 0, go: '/(client)/progress' as const },
    isAthlete
      ? { key: 'plan', label: 'Crea tu plan de entreno', done: Boolean(routine), go: '/(client)/my-plan' as const }
      : { key: 'checkin', label: 'Envía tu primer check-in', done: hasAnyCheckIn, go: null },
    { key: 'workout', label: 'Completa tu primer entrenamiento', done: workoutLogs.length > 0, go: '/(client)/workout' as const },
  ] as const;
  const showFirstSteps = firstSteps.some((s) => !s.done);
  const stepsDone = firstSteps.filter((s) => s.done).length;

  // Pago de la cuota al coach por Stripe Connect (directo, sin comisión UDECA).
  // Tras pagar, el webhook marca el cobro solo (client_reference_id = uid).
  const handlePayConnect = async () => {
    if (!profile?.trainerId || !profile.monthlyFeeEur) return;
    setPayingConnect(true);
    try {
      const r = await createCoachCheckoutUrl(profile.trainerId, profile.uid, profile.monthlyFeeEur);
      if (r.ok && r.url) {
        Linking.openURL(r.url).catch(() => {});
      } else {
        showToast(r.reason ? `No se pudo: ${r.reason}` : 'No se pudo abrir el pago');
      }
    } finally {
      setPayingConnect(false);
    }
  };

  // El alumno declara que ya ha pagado: lo registra y avisa al entrenador.
  const handleReportPayment = async () => {
    if (!profile) return;
    setReporting(true);
    try {
      await reportClientPayment(profile.uid);
      if (profile.trainerId) {
        notifyUser(
          profile.trainerId,
          'Pago declarado',
          `${profile.name?.split(' ')[0] ?? 'Un alumno'} dice que ya ha pagado su cuota. Revísalo y confírmalo.`
        ).catch(() => {});
      }
      await refreshProfile();
      showToast('Tu entrenador recibirá el aviso');
    } catch {
      showToast('No se pudo enviar el aviso');
    } finally {
      setReporting(false);
    }
  };

  // Aviso de pago para el alumno (dato en su propio perfil, lo fija el coach):
  // cobro próximo (ámbar) o cobro pendiente/vencido (rojo). Ayuda a que el
  // alumno renueve pronto y le facilita el trabajo al entrenador.
  const paymentAlert = (() => {
    const fee = profile?.monthlyFeeEur ? `${profile.monthlyFeeEur} €` : 'tu cuota';
    const startDay = (ts: number) => {
      const d = new Date(ts);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    };
    const fmt = (ts: number) =>
      new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    const due = profile?.nextPaymentDate;
    const status = profile?.paymentStatus;
    if (due) {
      const days = Math.round((startDay(due) - startDay(Date.now())) / (24 * 60 * 60 * 1000));
      if (days < 0)
        return {
          bad: true,
          title: 'Cobro pendiente',
          text: `Tu cuota de ${fee} venció el ${fmt(due)}. Renueva con tu entrenador para no perder el acceso.`,
        };
      if (days <= 5)
        return {
          bad: false,
          title: 'Cobro próximo',
          text:
            days === 0
              ? `Hoy vence tu cuota de ${fee}. Ponte al día con tu entrenador.`
              : `Tu cuota de ${fee} vence ${days === 1 ? 'mañana' : `en ${days} días`} (${fmt(due)}).`,
        };
      return null;
    }
    // Sin fecha, pero el coach marcó el estado a mano.
    if (status === 'overdue')
      return {
        bad: true,
        title: 'Cobro pendiente',
        text: `Tienes un pago pendiente de ${fee}. Renueva con tu entrenador.`,
      };
    if (status === 'pending')
      return {
        bad: false,
        title: 'Cobro próximo',
        text: `Tu entrenador espera el pago de ${fee}. Ponte al día cuando puedas.`,
      };
    return null;
  })();

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

      {paymentAlert ? (
        <View style={[styles.payCard, paymentAlert.bad ? styles.payCardBad : styles.payCardWarn]}>
          <Ionicons
            name={paymentAlert.bad ? 'alert-circle' : 'card-outline'}
            size={20}
            color={paymentAlert.bad ? colors.danger : colors.primaryBright}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.payTitle, { color: paymentAlert.bad ? colors.danger : colors.primaryBright }]}
            >
              {paymentAlert.title}
            </Text>
            <Text style={styles.payText}>{paymentAlert.text}</Text>
            {profile?.paymentReportedAt ? (
              <View style={styles.payReported}>
                <Ionicons name="checkmark-circle" size={15} color={colors.primaryBright} />
                <Text style={styles.payReportedText}>Pago informado · pendiente de confirmar</Text>
              </View>
            ) : (
              <View style={styles.payActions}>
                {trainerConnect && profile?.monthlyFeeEur ? (
                  <Pressable onPress={handlePayConnect} disabled={payingConnect} style={styles.payBtn}>
                    <Ionicons name="card" size={15} color={colors.onPrimary} />
                    <Text style={styles.payBtnText}>
                      {payingConnect ? 'Abriendo...' : `Pagar ${profile.monthlyFeeEur} €`}
                    </Text>
                  </Pressable>
                ) : trainerPayLink ? (
                  <Pressable
                    onPress={() =>
                      Linking.openURL(buildPayUrl(trainerPayLink, profile?.uid ?? '')).catch(
                        () => {}
                      )
                    }
                    style={styles.payBtn}
                  >
                    <Ionicons name="card" size={15} color={colors.onPrimary} />
                    <Text style={styles.payBtnText}>Pagar ahora</Text>
                  </Pressable>
                ) : null}
                {/* Con Stripe conectado el cobro se confirma solo (webhook), así
                    que no ofrecemos el "Ya he pagado" manual: solo se paga y el
                    aviso desaparece cuando el pago consta de verdad. */}
                {!(trainerConnect && profile?.monthlyFeeEur) ? (
                  <Pressable
                    onPress={handleReportPayment}
                    disabled={reporting}
                    style={styles.payReportBtn}
                  >
                    <Text style={styles.payReportBtnText}>Ya he pagado</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </View>
        </View>
      ) : null}

      <View style={styles.quoteWrap}>
        <View style={styles.quoteRule} />
        <Text style={styles.quoteText}>{quoteOfTheDay()}</Text>
      </View>

      {/* Atleta: acceso a gestionar su propio plan de entreno. */}
      {profile?.role === 'athlete' ? (
        <Pressable
          onPress={() => router.push('/(client)/my-plan')}
          style={styles.myPlanEntry}
        >
          <View style={styles.myPlanIcon}>
            <Ionicons name="construct-outline" size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.myPlanTitle}>Mi plan de entreno</Text>
            <Text style={styles.myPlanSub}>Crea y edita tus días y ejercicios.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Pressable>
      ) : null}

      {/* Petición de valoración: tras 5 entrenos, una sola vez. */}
      {!rateDismissed && workoutLogs.length >= 5 ? (
        <Card accent style={styles.rateCard}>
          <Ionicons name="star" size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rateTitle}>¿Te está gustando UDECA?</Text>
            <Text style={styles.rateSub}>Tu valoración nos ayuda un montón.</Text>
          </View>
          <View style={styles.rateActions}>
            <Pressable onPress={() => closeRate(true)} style={styles.rateBtn} hitSlop={6}>
              <Text style={styles.rateBtnText}>Valorar</Text>
            </Pressable>
            <Pressable onPress={() => closeRate(false)} hitSlop={6}>
              <Text style={styles.rateLater}>Ahora no</Text>
            </Pressable>
          </View>
        </Card>
      ) : null}

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
      <Pressable
        onPress={() =>
          router.push(isAthlete && !routine ? '/(client)/my-plan' : '/(client)/workout')
        }
      >
        <LinearGradient
          colors={gradients.goldSubtle}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.todayCard}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.todayLabel}>
              {routine?.schedule === 'flex'
                ? `${flexLabel(routine.scheduleLabel)} · eliges tú`
                : isCycle
                  ? `Días sueltos · ${todaySession.cycleLabel ?? ''}${
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
            ) : routine && routine.schedule === 'flex' ? (
              <>
                <Text style={styles.todayTitle}>
                  {flexLabel(routine.scheduleLabel, 'Rutina personalizada')}
                </Text>
                <Text style={styles.todaySub}>Tú eliges qué hacer hoy. Entra y empieza.</Text>
              </>
            ) : routine && nextDay ? (
              <>
                <Text style={styles.todayTitle}>{nextDay.name}</Text>
                <Text style={styles.todaySub}>
                  {nextDay.exercises.length} ejercicios · Empezar sesión
                </Text>
              </>
            ) : isAthlete ? (
              <>
                <Text style={styles.todayTitle}>Crea tu plan</Text>
                <Text style={styles.todaySub}>Diseña tus días y empieza hoy. Toca para crearlo.</Text>
              </>
            ) : (
              <>
                <Text style={styles.todayTitle}>Sin rutina aún</Text>
                <Text style={styles.todaySub}>Tu entrenador te la asignará pronto.</Text>
              </>
            )}
          </View>
          {(() => {
            const canTrain = !!routine && !restDay && (!!nextDay || routine.schedule === 'flex');
            const createPlan = isAthlete && !routine;
            const icon = canTrain ? 'play' : createPlan ? 'construct' : 'bed-outline';
            return (
              <View style={canTrain || createPlan ? styles.todayPlay : styles.todayRest}>
                <Ionicons
                  name={icon}
                  size={canTrain ? 26 : 24}
                  color={canTrain || createPlan ? colors.onPrimary : colors.primaryBright}
                />
              </View>
            );
          })()}
        </LinearGradient>
      </Pressable>

      {/* Ciclo en curso (solo si el coach usa planificación) */}
      {activeCyc
        ? (() => {
            const cs = computeCycleStats(activeCyc, workoutLogs);
            const wk = cycleWeekInfo(activeCyc);
            return (
              <View style={styles.cycleCard}>
                <View style={styles.cycleTop}>
                  <Text style={styles.cycleLevel}>{CYCLE_LEVEL_LABEL[activeCyc.level]}</Text>
                  <View style={styles.cycleWeekBadge}>
                    <Ionicons name="calendar-outline" size={12} color={colors.primaryBright} />
                    <Text style={styles.cycleWeekText}>
                      Semana {wk.week}
                      {wk.totalWeeks ? ` de ${wk.totalWeeks}` : ''}
                    </Text>
                  </View>
                  {activeCyc.isDeload ? (
                    <Text style={styles.cycleDeload}>Semana de descarga</Text>
                  ) : null}
                </View>
                <Text style={styles.cycleName}>{activeCyc.name}</Text>
                {cs.pctComplete != null ? (
                  <View style={{ marginTop: spacing.sm }}>
                    <ProgressBar progress={cs.pctComplete} height={7} />
                  </View>
                ) : null}
                <Text style={styles.cycleMeta}>
                  {cs.sessionsDone}
                  {activeCyc.targetSessions ? `/${activeCyc.targetSessions}` : ''} sesiones
                  {cs.pctComplete != null ? ` · ${Math.round(cs.pctComplete * 100)}%` : ''}
                  {activeCyc.endDate
                    ? ` · hasta ${new Date(activeCyc.endDate).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                      })}`
                    : ''}
                </Text>
                {activeCyc.goal ? <Text style={styles.cycleGoal}>{activeCyc.goal}</Text> : null}
              </View>
            );
          })()
        : null}

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
                ? '¡Objetivo de la semana cumplido!'
                : `Te faltan ${targetSessions - sessions} sesión(es) para cumplir tu semana.`}
            </Text>
          </>
        ) : (
          <Text style={styles.weekHint}>
            {isAthlete
              ? 'Crea tu plan para ver aquí tu semana y tu objetivo de sesiones.'
              : 'Cuando tengas rutina asignada verás aquí tu plan y objetivo semanal.'}
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

      {needsCheckIn && profile && !isAthlete ? (
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
    backgroundColor: colors.warningMuted,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  payCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  payCardWarn: { backgroundColor: colors.primaryMuted, borderColor: colors.hairline },
  payCardBad: { backgroundColor: colors.dangerMuted, borderColor: colors.danger },
  payTitle: { ...typography.body, fontFamily: fonts.semiBold },
  payText: { ...typography.small, color: colors.textMuted, marginTop: 1, lineHeight: 18 },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  payBtnText: { ...typography.small, color: colors.onPrimary, fontFamily: fonts.heading },
  payActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  payReportBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  payReportBtnText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  payReported: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm },
  payReportedText: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold },
  reminderText: { ...typography.small, color: colors.warning, fontFamily: fonts.semiBold, flex: 1 },
  quoteWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingRight: spacing.md,
  },
  rateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  rateTitle: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  rateSub: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  rateActions: { alignItems: 'flex-end', gap: 4 },
  rateBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  rateBtnText: { ...typography.small, color: colors.onPrimary, fontFamily: fonts.semiBold, fontSize: 12 },
  rateLater: { ...typography.small, color: colors.textFaint, fontSize: 11 },
  myPlanEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.primaryMuted,
    marginBottom: spacing.md,
  },
  myPlanIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myPlanTitle: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  myPlanSub: { ...typography.small, color: colors.textFaint, marginTop: 1 },
  quoteRule: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: colors.primary },
  quoteText: {
    ...typography.body,
    color: colors.textMuted,
    fontStyle: 'italic',
    flex: 1,
    lineHeight: 21,
  },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  cycleCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cycleTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cycleLevel: { ...typography.label, color: colors.primary, textTransform: 'uppercase' },
  cycleDeload: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold, fontSize: 11 },
  cycleName: { ...typography.h3, color: colors.text, marginTop: 4 },
  cycleMeta: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm },
  cycleGoal: { ...typography.small, color: colors.textFaint, marginTop: 4, fontStyle: 'italic' },
  cycleWeekBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.primaryMuted,
  },
  cycleWeekText: {
    ...typography.small,
    color: colors.primaryBright,
    fontFamily: fonts.semiBold,
    fontSize: 11,
  },
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
