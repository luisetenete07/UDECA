import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Confetti } from '../../components/Confetti';
import { FadeIn, PopIn } from '../../components/FadeIn';
import { EmptyState } from '../../components/EmptyState';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ProgressBar } from '../../components/ProgressBar';
import { RestTimer } from '../../components/RestTimer';
import { ScreenContainer } from '../../components/ScreenContainer';
import { StatTile } from '../../components/StatTile';
import { TextField } from '../../components/TextField';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import { getExercisesForTrainer } from '../../lib/firestore/exercises';
import { getActiveRoutineForClient } from '../../lib/firestore/routines';
import { createWorkoutLog, getWorkoutLogsForClient } from '../../lib/firestore/workoutLogs';
import { syncMySocialStats } from '../../lib/firestore/social';
import { resolveTodaySession } from '../../lib/schedule';
import { notifyUser } from '../../lib/notifications';
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
// Una sesión a medias caduca a las 12 h: después se descarta sola.
const DRAFT_TTL_MS = 12 * 60 * 60 * 1000;

interface WorkoutDraft {
  routineId: string;
  dayId: string;
  log: LoggedExercise[];
  startedAt: number | null;
  savedAt: number;
}

const draftKey = (uid: string) => `udeca-workout-draft-${uid}`;

/** Formatea segundos de descanso de forma legible (1 min, 1.5 min, 45 s). */
function formatRest(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const m = seconds / 60;
  const mins = Number.isInteger(m) ? String(m) : m.toFixed(1).replace(/\.0$/, '');
  return `${mins} min`;
}

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
  const [videoByExercise, setVideoByExercise] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [restKey, setRestKey] = useState(0);
  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  const [restored, setRestored] = useState(false);
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
        // Vídeos de técnica de la biblioteca del entrenador (no bloquea).
        if (profile.trainerId) {
          getExercisesForTrainer(profile.trainerId)
            .then((library) => {
              if (cancelled) return;
              const map: Record<string, string> = {};
              for (const ex of library) if (ex.videoUrl) map[ex.id] = ex.videoUrl;
              setVideoByExercise(map);
            })
            .catch(() => {});
        }
        if (data && data.days.length > 0) {
          // Preselecciona el día que toca hoy (Método REIN TENA o semanal).
          const session = resolveTodaySession(data);
          const fallback = data.days.find((d) => !d.isRest) ?? data.days[0];
          setSelectedDayId((prev) => prev ?? session.day?.id ?? fallback.id);
        }
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [profile])
  );

  useEffect(() => {
    if (!routine || !selectedDayId || !profile) return;
    const day = routine.days.find((d) => d.id === selectedDayId);
    if (!day) return;
    let cancelled = false;
    (async () => {
      // Si hay una sesión a medias de este mismo día, se recupera.
      try {
        const raw = await AsyncStorage.getItem(draftKey(profile.uid));
        if (raw) {
          const draft: WorkoutDraft = JSON.parse(raw);
          const fresh = Date.now() - draft.savedAt < DRAFT_TTL_MS;
          if (
            fresh &&
            draft.routineId === routine.id &&
            draft.dayId === selectedDayId &&
            draft.log.some((ex) => ex.sets.some((st) => st.completed))
          ) {
            if (cancelled) return;
            setLog(draft.log);
            startedAt.current = draft.startedAt;
            setRestored(true);
            setSummary(null);
            setRestSeconds(null);
            return;
          }
        }
      } catch {
        // Borrador ilegible: se ignora y se empieza limpio.
      }
      if (cancelled) return;
      setLog(buildLog(day));
      setRestored(false);
      setSummary(null);
      setRestSeconds(null);
      startedAt.current = null;
    })();
    return () => {
      cancelled = true;
    };
  }, [routine, selectedDayId, profile]);

  // Guarda el borrador en el dispositivo con cada cambio de la sesión.
  useEffect(() => {
    if (!profile || !routine || !selectedDayId) return;
    const hasProgress = log.some((ex) => ex.sets.some((st) => st.completed));
    if (!hasProgress) return;
    const draft: WorkoutDraft = {
      routineId: routine.id,
      dayId: selectedDayId,
      log,
      startedAt: startedAt.current,
      savedAt: Date.now(),
    };
    AsyncStorage.setItem(draftKey(profile.uid), JSON.stringify(draft)).catch(() => {});
  }, [log, profile, routine, selectedDayId]);

  const discardDraft = () => {
    if (!routine || !selectedDayId) return;
    const day = routine.days.find((d) => d.id === selectedDayId);
    if (profile) AsyncStorage.removeItem(draftKey(profile.uid)).catch(() => {});
    if (day) setLog(buildLog(day));
    startedAt.current = null;
    setRestored(false);
  };

  const day = routine?.days.find((d) => d.id === selectedDayId) ?? null;
  const todaySession = resolveTodaySession(routine);

  const handleShareSummary = async () => {
    if (!summary || !routine) return;
    const parts = [
      `Sesión completada en UDECA: ${day?.name ?? routine.name}`,
      summary.durationMin > 0 ? `${summary.durationMin} min` : null,
      `${summary.sets} series · ${summary.reps} reps`,
      summary.volumeKg > 0 ? `${summary.volumeKg} kg de volumen` : null,
      summary.prs.length > 0
        ? `${summary.prs.length} récord${summary.prs.length > 1 ? 's' : ''} personal${
            summary.prs.length > 1 ? 'es' : ''
          }`
        : null,
      summary.streak > 1 ? `Racha: ${summary.streak} días` : null,
    ].filter(Boolean);
    const message = `${parts.join(' · ')}\n\nEntreno con UDECA — Universidad de Calistenia`;
    try {
      await Share.share({ message });
    } catch {
      // El usuario canceló o el navegador no soporta compartir: copiamos.
      try {
        await navigator.clipboard.writeText(message);
        showToast('Resumen copiado, pégalo donde quieras');
      } catch {
        showToast('No se pudo compartir');
      }
    }
  };

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
      // En superserie no hay descanso: se encadena con el siguiente ejercicio.
      const nextIsLinked = day?.exercises[exerciseIndex + 1]?.supersetWithPrevious === true;
      if (!nextIsLinked) {
        const rest = day?.exercises[exerciseIndex]?.restSeconds || DEFAULT_REST_SECONDS;
        setRestSeconds(rest);
        setRestKey((k) => k + 1);
      }
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
    setSaveError(null);
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
      // Aviso al coach en tiempo real (nunca bloquea el guardado).
      notifyUser(
        routine.trainerId,
        'Sesión completada',
        `${profile.name.split(' ')[0]} ha terminado ${day.name} (${totals.sets} series${
          prs.length > 0 ? `, ${prs.length} récord${prs.length > 1 ? 's' : ''}` : ''
        }).`
      ).catch(() => {});
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setRestSeconds(null);
      if (profile) AsyncStorage.removeItem(draftKey(profile.uid)).catch(() => {});
      setRestored(false);
      setSummary({
        durationMin,
        ...totals,
        prs,
        streak: currentStreak(freshLogs),
      });
      setHistory(freshLogs);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'No se pudo guardar la sesión.');
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
        <Confetti />
        <PopIn style={{ alignSelf: 'center' }}>
          <View style={styles.summaryBadge}>
            <Ionicons name="checkmark" size={44} color={colors.onPrimary} />
          </View>
        </PopIn>
        <FadeIn delay={150}>
          <Text style={styles.summaryTitle}>Sesión completada</Text>
          <Text style={styles.summarySubtitle}>
            {routine.name} · {day?.name}
          </Text>
        </FadeIn>

        <FadeIn delay={300} style={styles.summaryTiles}>
          {summary.durationMin > 0 ? (
            <StatTile icon="time" value={`${summary.durationMin} min`} label="Duración" />
          ) : null}
          <StatTile icon="layers" value={`${summary.sets}`} label="Series" />
          <StatTile icon="repeat" value={`${summary.reps}`} label="Reps" />
          {summary.volumeKg > 0 ? (
            <StatTile
              icon="barbell"
              value={`${summary.volumeKg.toLocaleString('es-ES')} kg`}
              label="Volumen"
            />
          ) : null}
        </FadeIn>

        {summary.prs.length > 0 ? (
          <FadeIn delay={450}>
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
          </FadeIn>
        ) : null}

        {summary.streak > 1 ? (
          <View style={styles.streakRow}>
            <Ionicons name="flame" size={18} color={colors.primary} />
            <Text style={styles.streakText}>Racha de {summary.streak} días. Sigue así.</Text>
          </View>
        ) : null}

        <Button
          title="Compartir mi sesión"
          onPress={handleShareSummary}
          style={{ marginTop: spacing.lg }}
        />
        <Button
          title="Volver al entrenamiento"
          variant="secondary"
          onPress={() => {
            if (day) setLog(buildLog(day));
            setSummary(null);
            startedAt.current = null;
          }}
          style={{ marginTop: spacing.sm }}
        />
      </ScreenContainer>
    );
  }

  // ---------- Modo entreno ----------
  return (
    <ScreenContainer>
      <Text style={styles.title}>{routine.name}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayTabs}>
        {routine.days.map((d, i) => {
          const isCycle = routine.schedule === 'cycle';
          const isToday = isCycle
            ? todaySession.cycleIndex === i
            : d.weekday === todayWeekday();
          return (
            <Pressable
              key={d.id}
              onPress={() => setSelectedDayId(d.id)}
              style={[styles.dayTab, selectedDayId === d.id && styles.dayTabSelected]}
            >
              <Text
                style={[styles.dayTabText, selectedDayId === d.id && styles.dayTabTextSelected]}
              >
                {isCycle
                  ? `Día ${i + 1}`
                  : `${d.weekday !== undefined ? `${WEEKDAY_NAMES[d.weekday].slice(0, 3)} · ` : ''}${d.name}`}
                {d.isRest ? ' · descanso' : ''}
                {isToday ? '  ·  HOY' : ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {totalSets > 0 ? (
        <View style={styles.progressWrap}>
          <View style={{ flex: 1 }}>
            <ProgressBar progress={progress} height={6} />
          </View>
          <Text style={styles.progressText}>
            {doneSets}/{totalSets} series
          </Text>
        </View>
      ) : null}

      {restored ? (
        <View style={styles.restoredBanner}>
          <Ionicons name="refresh-circle-outline" size={16} color={colors.primary} />
          <Text style={styles.restoredText}>Sesión anterior recuperada</Text>
          <Pressable onPress={discardDraft} hitSlop={6}>
            <Text style={styles.restoredAction}>Empezar de cero</Text>
          </Pressable>
        </View>
      ) : null}

      {restSeconds !== null ? (
        <RestTimer key={restKey} seconds={restSeconds} onDone={() => setRestSeconds(null)} />
      ) : null}

      {log.map((exercise, exerciseIndex) => {
        const prev = lastPerf[exercise.exerciseId];
        const planned = day?.exercises[exerciseIndex];
        const isCurrent = exerciseIndex === currentIndex;
        const isDone = exercise.sets.length > 0 && exercise.sets.every((s) => s.completed);
        return (
          <Card
            key={exercise.exerciseId + exerciseIndex}
            accent={isCurrent}
            style={[styles.exerciseCard, isDone && styles.exerciseCardDone]}
          >
            {planned?.supersetWithPrevious ? (
              <View style={styles.supersetRow}>
                <Ionicons name="link" size={12} color={colors.primaryBright} />
                <Text style={styles.supersetText}>SUPERSERIE con el anterior — sin descanso</Text>
              </View>
            ) : null}
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
            {planned ? (
              <View style={styles.metaRow}>
                <View style={styles.metaChip}>
                  <Text style={styles.metaChipText}>
                    {planned.sets} × {planned.reps}
                    {planned.measure === 'seconds' ? 's' : ''}
                  </Text>
                </View>
                {planned.rir !== undefined && planned.rir !== null ? (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>RIR {planned.rir}</Text>
                  </View>
                ) : null}
                {planned.restSeconds ? (
                  <View style={styles.metaChip}>
                    <Text style={styles.metaChipText}>
                      Descanso {formatRest(planned.restSeconds)}
                    </Text>
                  </View>
                ) : null}
                {planned.band ? (
                  <View style={[styles.metaChip, styles.metaChipBand]}>
                    <Text style={styles.metaChipText}>Con goma</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            {planned?.notes ? <Text style={styles.coachNotes}>{planned.notes}</Text> : null}
            {videoByExercise[exercise.exerciseId] ? (
              <Pressable
                onPress={() => Linking.openURL(videoByExercise[exercise.exerciseId])}
                style={styles.videoLink}
                hitSlop={4}
              >
                <Ionicons name="play-circle-outline" size={15} color={colors.primary} />
                <Text style={styles.videoLinkText}>Ver técnica</Text>
              </Pressable>
            ) : null}
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
                  placeholder={planned?.measure === 'seconds' ? 'Seg' : 'Reps'}
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

      {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}

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
  supersetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.xs,
  },
  supersetText: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    letterSpacing: 1,
    color: colors.primaryBright,
  },
  restoredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  restoredText: { ...typography.small, color: colors.primaryBright, flex: 1 },
  restoredAction: {
    ...typography.small,
    color: colors.primary,
    fontFamily: fonts.semiBold,
    textDecorationLine: 'underline',
  },
  saveError: {
    ...typography.small,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  coachNotes: {
    ...typography.small,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.sm,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  metaChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaChipBand: { borderColor: colors.hairline, backgroundColor: colors.primaryMuted },
  metaChipText: { ...typography.small, color: colors.primaryBright, fontSize: 11, fontFamily: fonts.semiBold },
  videoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  videoLinkText: {
    ...typography.small,
    color: colors.primary,
    fontFamily: fonts.semiBold,
    textDecorationLine: 'underline',
  },
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
