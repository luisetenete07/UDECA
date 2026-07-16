import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { LineChart } from '../../components/LineChart';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { WeightChart } from '../../components/WeightChart';
import { useAuth } from '../../lib/auth-context';
import { showToast } from '../../components/Toast';
import { createWeightLog, deleteWeightLog, getWeightLogsForClient } from '../../lib/firestore/weightLogs';
import { getCached, setCached } from '../../lib/screenCache';
import { deleteWorkoutLog, getWorkoutLogsForClient } from '../../lib/firestore/workoutLogs';
import { getExercisesForTrainer } from '../../lib/firestore/exercises';
import { getLevelTestsForClient } from '../../lib/firestore/levelTests';
import {
  exerciseProgression,
  isIsometricExercise,
  listExercisesInLogs,
  sessionTotals,
  setsByMuscleGroup,
  topExercises,
  trainingDays,
  weeklyActivity,
  weeklySetsByGroup,
  thenVsNow,
  workoutsByMonth,
} from '../../lib/stats';
import { ConsistencyMap } from '../../components/ConsistencyMap';
import { FadeIn } from '../../components/FadeIn';
import { fonts, colors, radius, spacing, typography } from '../../lib/theme';
import {
  type WeightLog,
  type WorkoutLog,
} from '../../lib/types';

type Tab = 'workouts' | 'weight' | 'exercises';

/** Pone en mayúscula la primera letra (para "julio 2026" → "Julio 2026"). */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface ProgressData {
  weightLogs: WeightLog[];
  workoutLogs: WorkoutLog[];
}

export default function ProgressScreen() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('workouts');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});
  // Pinta al instante lo último conocido (caché de sesión) y refresca detrás.
  const cacheKey = `progress-${profile?.uid ?? ''}`;
  const cached = getCached<ProgressData>(cacheKey);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>(cached?.weightLogs ?? []);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>(cached?.workoutLogs ?? []);
  const [measureByExercise, setMeasureByExercise] = useState<Record<string, string>>({});
  const [muscleByExercise, setMuscleByExercise] = useState<Record<string, string>>({});
  const [levelTests, setLevelTests] = useState<import('../../lib/types').LevelTest[]>([]);
  const [loading, setLoading] = useState(cached === undefined);
  const [refreshing, setRefreshing] = useState(false);

  const [weightInput, setWeightInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const [weightData, workoutData, testData] = await Promise.all([
      getWeightLogsForClient(profile.uid),
      getWorkoutLogsForClient(profile.uid),
      getLevelTestsForClient(profile.uid).catch(() => []),
    ]);
    setWeightLogs(weightData);
    setWorkoutLogs(workoutData);
    setLevelTests(testData);
    setCached(cacheKey, {
      weightLogs: weightData,
      workoutLogs: workoutData,
    } satisfies ProgressData);
    // Medida actual de cada ejercicio (reps/segundos) desde la biblioteca del
    // coach, para mostrar bien los isométricos aunque el registro sea antiguo.
    if (profile.trainerId) {
      getExercisesForTrainer(profile.trainerId)
        .then((library) => {
          const mmap: Record<string, string> = {};
          const gmap: Record<string, string> = {};
          for (const ex of library) {
            mmap[ex.id] = ex.measure ?? 'reps';
            gmap[ex.id] = ex.muscleGroup;
          }
          setMeasureByExercise(mmap);
          setMuscleByExercise(gmap);
        })
        .catch(() => {});
    }
    setLoading(false);
    setRefreshing(false);
  }, [profile, cacheKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleAddWeight = async () => {
    if (!profile) return;
    const parsed = Number(weightInput.replace(',', '.'));
    if (!parsed || parsed <= 0) {
      setError('Introduce un peso válido en kg.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createWeightLog({
        trainerId: profile.trainerId ?? '',
        clientId: profile.uid,
        date: Date.now(),
        weightKg: parsed,
        notes: notesInput.trim() || undefined,
      });
      setWeightInput('');
      setNotesInput('');
      await load();
      showToast('Peso guardado');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (message: string): Promise<boolean> => {
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      return Promise.resolve(window.confirm(message));
    }
    return new Promise((resolve) => {
      Alert.alert('Borrar registro', message, [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Borrar', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
  };

  const handleDeleteWeight = async (id: string) => {
    if (!(await confirmDelete('¿Borrar este registro de peso?'))) return;
    setWeightLogs((prev) => prev.filter((l) => l.id !== id));
    await deleteWeightLog(id);
    showToast('Registro borrado');
  };

  const handleDeleteWorkout = async (id: string) => {
    if (!(await confirmDelete('¿Borrar este entrenamiento del registro?'))) return;
    setWorkoutLogs((prev) => prev.filter((l) => l.id !== id));
    try {
      await deleteWorkoutLog(id);
      showToast('Entrenamiento borrado');
    } catch (e) {
      await load(); // si falla, recargamos para no perder el registro de la vista
      showToast(e instanceof Error ? e.message : 'No se pudo borrar');
    }
  };

  if (loading) return <LoadingScreen />;

  const months = workoutsByMonth(workoutLogs, measureByExercise);
  const toggleSession = (id: string) =>
    setExpandedSessions((prev) => ({ ...prev, [id]: !prev[id] }));

  const comparison = thenVsNow(workoutLogs, weightLogs);
  const muscleMap = setsByMuscleGroup(workoutLogs, muscleByExercise);
  const muscleMax = muscleMap.length > 0 ? muscleMap[0].sets : 0;
  const weeklySets = weeklySetsByGroup(workoutLogs, muscleByExercise);
  const pushPoints = weeklySets.map((w) => ({ date: w.weekStart, value: w.pushSets }));
  const pullPoints = weeklySets.map((w) => ({ date: w.weekStart, value: w.pullSets }));

  // Datos del historial por ejercicio (tab "Ejercicios").
  const exercisesInLogs = listExercisesInLogs(workoutLogs);
  const selExerciseId = selectedExerciseId ?? exercisesInLogs[0]?.exerciseId ?? null;
  const progression = selExerciseId ? exerciseProgression(workoutLogs, selExerciseId) : null;
  const progMetric = progression?.measure === 'seconds' ? 's' : progression?.hasWeight ? 'kg' : 'reps';
  const progPoints = progression
    ? progression.points.map((p) => ({
        date: p.date,
        value: progMetric === 'kg' ? p.weight : p.reps,
      }))
    : [];
  const progBest = progPoints.reduce((m, p) => Math.max(m, p.value), 0);

  return (
    <ScreenContainer
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <Text style={styles.title}>Mi progreso</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabs}
      >
        <TabButton label="Entrenos" active={tab === 'workouts'} onPress={() => setTab('workouts')} />
        <TabButton label="Peso" active={tab === 'weight'} onPress={() => setTab('weight')} />
        <TabButton
          label="Ejercicios"
          active={tab === 'exercises'}
          onPress={() => setTab('exercises')}
        />
      </ScrollView>

      {tab === 'workouts' ? (
        months.length === 0 ? (
          <Card style={styles.section}>
            <EmptyState
              icon="barbell-outline"
              title="Aún no hay entrenamientos"
              subtitle="Cuando termines una sesión se guardará aquí, en tu registro mensual."
            />
          </Card>
        ) : (
          <>
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Constancia (12 semanas)</Text>
              <Text style={styles.photoHint}>Cada punto dorado es un día entrenado.</Text>
              <ConsistencyMap days={trainingDays(workoutLogs)} />
            </Card>

            {comparison ? (
              <Card accent style={styles.section}>
                <Text style={styles.sectionTitle}>Hace 3 meses → hoy</Text>
                <Text style={styles.photoHint}>
                  Tus últimos 28 días frente a los mismos días de hace 3 meses.
                </Text>
                <CompareRow
                  label="Sesiones"
                  then={comparison.then.sessions}
                  now={comparison.now.sessions}
                />
                <CompareRow
                  label="Series"
                  then={comparison.then.sets}
                  now={comparison.now.sets}
                />
                {comparison.then.volumeKg > 0 || comparison.now.volumeKg > 0 ? (
                  <CompareRow
                    label="Volumen (kg)"
                    then={comparison.then.volumeKg}
                    now={comparison.now.volumeKg}
                  />
                ) : null}
                {comparison.then.weightKg != null && comparison.now.weightKg != null ? (
                  <CompareRow
                    label="Peso corporal"
                    then={comparison.then.weightKg}
                    now={comparison.now.weightKg}
                    neutral
                  />
                ) : null}
              </Card>
            ) : null}

            {months.map((m, mi) => (
              <FadeIn key={m.key} delay={Math.min(mi * 60, 240)}>
              <Card style={styles.section}>
                <View style={styles.monthHeader}>
                  <Text style={styles.monthTitle}>{capitalize(m.label)}</Text>
                  <Text style={styles.monthCount}>
                    {m.sessions.length} {m.sessions.length === 1 ? 'sesión' : 'sesiones'}
                  </Text>
                </View>
                <View style={styles.monthStats}>
                  <MonthStat value={String(m.totalSets)} label="series" />
                  {m.totalReps > 0 ? <MonthStat value={String(m.totalReps)} label="reps" /> : null}
                  {m.totalSeconds > 0 ? (
                    <MonthStat value={`${m.totalSeconds}s`} label="isom." />
                  ) : null}
                  {m.volumeKg > 0 ? (
                    <MonthStat value={m.volumeKg.toLocaleString('es-ES')} label="kg vol." />
                  ) : null}
                </View>

                {m.sessions.map((s) => {
                  const t = sessionTotals(s.exercises, measureByExercise);
                  const open = expandedSessions[s.id];
                  const d = new Date(s.date);
                  const meta = [
                    `${t.sets} series`,
                    t.reps > 0 ? `${t.reps} reps` : null,
                    t.seconds > 0 ? `${t.seconds}s` : null,
                    t.volumeKg > 0 ? `${t.volumeKg.toLocaleString('es-ES')} kg` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <View key={s.id}>
                      <View style={styles.sessionRow}>
                        <Pressable style={styles.sessionMain} onPress={() => toggleSession(s.id)}>
                          <View style={styles.sessionDateBox}>
                            <Text style={styles.sessionDay}>{d.getDate()}</Text>
                            <Text style={styles.sessionMon}>
                              {d.toLocaleDateString('es-ES', { month: 'short' })}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.sessionName} numberOfLines={1}>
                              {s.dayName}
                            </Text>
                            <Text style={styles.sessionMeta}>{meta}</Text>
                          </View>
                          <Ionicons
                            name={open ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={colors.textFaint}
                          />
                        </Pressable>
                        <Pressable
                          onPress={() => handleDeleteWorkout(s.id)}
                          hitSlop={8}
                          style={styles.sessionDelete}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
                        </Pressable>
                      </View>
                      {open ? (
                        <View style={styles.sessionDetail}>
                          {s.exercises.map((ex, i) => {
                            const isSec = isIsometricExercise(ex, measureByExercise);
                            const done = ex.sets
                              .filter((st) => st.completed && st.reps)
                              .map((st) => `${st.reps}${st.weight ? `×${st.weight}kg` : ''}`)
                              .join(', ');
                            return (
                              <View key={i} style={styles.detailRow}>
                                <Text style={styles.detailName} numberOfLines={1}>
                                  {ex.name}
                                </Text>
                                <Text style={styles.detailSets}>
                                  {done ? `${done}${isSec ? ' s' : ''}` : '✓'}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </Card>
              </FadeIn>
            ))}

            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Volumen semanal (kg)</Text>
              <LineChart
                points={weeklyActivity(workoutLogs).map((w) => ({
                  date: w.weekStart,
                  value: w.volumeKg,
                }))}
                unit="kg"
                emptyMessage="Registra entrenamientos con peso para ver tu volumen semanal."
              />
            </Card>

            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Series semanales · Empuje</Text>
              <Text style={styles.photoHint}>Total de series de empuje completadas cada semana.</Text>
              <LineChart
                points={pushPoints}
                unit="series"
                emptyMessage="Marca ejercicios como 'Empuje' en tu biblioteca para ver este dato."
              />
              <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
                Series semanales · Tirón
              </Text>
              <Text style={styles.photoHint}>Total de series de tirón completadas cada semana.</Text>
              <LineChart
                points={pullPoints}
                unit="series"
                emptyMessage="Marca ejercicios como 'Tirón' en tu biblioteca para ver este dato."
              />
            </Card>

            {muscleMap.length > 0 ? (
              <Card style={styles.section}>
                <Text style={styles.sectionTitle}>Mapa muscular (28 días)</Text>
                <Text style={styles.photoHint}>Series completadas por patrón de movimiento.</Text>
                {muscleMap.map((m) => (
                  <View key={m.group} style={styles.muscleRow}>
                    <Text style={styles.muscleLabel} numberOfLines={1}>
                      {m.group}
                    </Text>
                    <View style={styles.muscleTrack}>
                      <View
                        style={[
                          styles.muscleFill,
                          { width: `${Math.max(6, (m.sets / muscleMax) * 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.muscleValue}>{m.sets}</Text>
                  </View>
                ))}
              </Card>
            ) : null}

            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Ejercicios más entrenados</Text>
              {topExercises(workoutLogs).map((ex, i) => (
                <View key={ex.name} style={styles.logRow}>
                  <Text style={styles.logValue}>
                    {i + 1}. {ex.name}
                  </Text>
                  <Text style={styles.logDate}>{ex.count} sesiones</Text>
                </View>
              ))}
            </Card>
          </>
        )
      ) : null}

      {tab === 'weight' ? (
        <>
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Evolución del peso</Text>
            <WeightChart logs={weightLogs} />
          </Card>

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Registrar peso</Text>
            <TextField
              placeholder="Peso en kg (ej. 66,4)"
              keyboardType="decimal-pad"
              value={weightInput}
              onChangeText={setWeightInput}
            />
            <TextField placeholder="Notas (opcional)" value={notesInput} onChangeText={setNotesInput} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Guardar registro" onPress={handleAddWeight} loading={saving} />
          </Card>

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Historial</Text>
            {weightLogs.length === 0 ? (
              <EmptyState title="Todavía no has registrado tu peso" />
            ) : (
              [...weightLogs].reverse().map((log) => (
                <View key={log.id} style={styles.logRow}>
                  <Text style={styles.logValue}>{log.weightKg} kg</Text>
                  <Text style={styles.logDate}>
                    {new Date(log.date).toLocaleDateString('es-ES')}
                  </Text>
                  <Pressable onPress={() => handleDeleteWeight(log.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
                  </Pressable>
                </View>
              ))
            )}
          </Card>
        </>
      ) : tab === 'exercises' ? (
        <>
          {levelTests.length > 0 ? (
            <Card accent style={styles.section}>
              <View style={styles.exHeader}>
                <Text style={styles.sectionTitle}>Tus marcas verificadas</Text>
              </View>
              <Text style={styles.photoHint}>Tests de nivel confirmados por tu entrenador.</Text>
              {levelTests.slice(0, 8).map((t) => (
                <View key={t.id} style={styles.logRow}>
                  <Text style={styles.logValue}>{t.name}</Text>
                  <Text style={styles.testMark}>
                    {t.value} {t.unit === 'reps' ? 'reps' : 's'}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}
          {exercisesInLogs.length === 0 ? (
            levelTests.length === 0 ? (
              <Card style={styles.section}>
                <EmptyState
                  title="Aún no hay datos por ejercicio"
                  subtitle="Cuando completes entrenamientos verás aquí cómo mejoras en cada ejercicio."
                />
              </Card>
            ) : null
          ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.exPickerRow}
            >
              {exercisesInLogs.map((ex) => {
                const active = selExerciseId === ex.exerciseId;
                return (
                  <Pressable
                    key={ex.exerciseId}
                    onPress={() => setSelectedExerciseId(ex.exerciseId)}
                    style={[styles.exChip, active && styles.exChipActive]}
                  >
                    <Text style={[styles.exChipText, active && styles.exChipTextActive]}>
                      {ex.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Card style={styles.section}>
              <View style={styles.exHeader}>
                <Text style={styles.sectionTitle}>{progression?.name ?? 'Ejercicio'}</Text>
                {progBest > 0 ? (
                  <View style={styles.recordPill}>
                    <Ionicons name="trophy" size={13} color={colors.primary} />
                    <Text style={styles.recordText}>
                      Récord: {progBest} {progMetric}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.photoHint}>
                {progMetric === 'kg'
                  ? 'Mejor peso por sesión.'
                  : progMetric === 's'
                    ? 'Mejor aguante (segundos) por sesión.'
                    : 'Mejores repeticiones por sesión.'}
              </Text>
              <LineChart
                points={progPoints}
                unit={progMetric}
                emptyMessage="Necesitas al menos dos sesiones con este ejercicio."
              />
            </Card>
          </>
          )}
        </>
      ) : null}
    </ScreenContainer>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

/** Fila del comparador 3 meses → hoy, con delta coloreado. */
function CompareRow({
  label,
  then,
  now,
  neutral,
}: {
  label: string;
  then: number;
  now: number;
  neutral?: boolean;
}) {
  const delta = now - then;
  const flat = Math.abs(delta) < 0.05;
  const color = neutral || flat ? colors.textMuted : delta > 0 ? '#2E7D5B' : colors.danger;
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));
  return (
    <View style={styles.compareRow}>
      <Text style={styles.compareLabel}>{label}</Text>
      <Text style={styles.compareThen}>{fmt(then)}</Text>
      <Ionicons name="arrow-forward" size={13} color={colors.textFaint} />
      <Text style={styles.compareNow}>{fmt(now)}</Text>
      <Text style={[styles.compareDelta, { color }]}>
        {flat ? '=' : `${delta > 0 ? '+' : ''}${fmt(delta)}`}
      </Text>
    </View>
  );
}

function MonthStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.monthStat}>
      <Text style={styles.monthStatValue}>{value}</Text>
      <Text style={styles.monthStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.md },
  tabsScroll: { marginBottom: spacing.lg, flexGrow: 0 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  tabButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  exPickerRow: { gap: spacing.sm, paddingBottom: spacing.sm },
  exChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  exChipText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  exChipTextActive: { color: colors.onPrimary },
  exHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recordPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: spacing.sm,
  },
  recordText: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold, fontSize: 11 },
  tabButtonActive: { backgroundColor: colors.primary },
  tabButtonText: { ...typography.small, fontFamily: fonts.heading, color: colors.textMuted },
  tabButtonTextActive: { color: colors.onPrimary },
  section: { marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  smallField: { flex: 1 },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.sm },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  logValue: { ...typography.body, color: colors.text, fontFamily: fonts.heading, flex: 1, marginRight: spacing.sm },
  testMark: { ...typography.body, color: colors.primaryBright, fontFamily: fonts.heading },
  logDate: { ...typography.small, color: colors.textMuted },
  // ----- Mapa muscular -----
  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  muscleLabel: { ...typography.small, color: colors.text, width: 104, fontFamily: fonts.medium },
  muscleTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  muscleFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 5 },
  muscleValue: {
    ...typography.small,
    color: colors.primaryBright,
    fontFamily: fonts.semiBold,
    width: 30,
    textAlign: 'right',
  },
  // ----- Comparador 3 meses → hoy -----
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  compareLabel: { ...typography.small, color: colors.textMuted, flex: 1 },
  compareThen: { ...typography.body, color: colors.textFaint, fontFamily: fonts.medium },
  compareNow: { ...typography.body, color: colors.text, fontFamily: fonts.heading },
  compareDelta: { ...typography.small, fontFamily: fonts.semiBold, width: 52, textAlign: 'right' },
  // ----- Registro de entrenamiento mensual -----
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  monthTitle: { ...typography.h3, color: colors.text },
  monthCount: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold },
  monthStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  monthStat: {
    flex: 1,
    minWidth: 64,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthStatValue: { ...typography.h3, color: colors.primaryBright, fontSize: 18 },
  monthStatLabel: { fontSize: 10, color: colors.textMuted, fontFamily: fonts.medium, marginTop: 2 },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sessionMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  sessionDelete: { padding: spacing.xs },
  sessionDateBox: {
    width: 44,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  sessionDay: { ...typography.body, color: colors.primaryBright, fontFamily: fonts.heading, fontSize: 16 },
  sessionMon: { fontSize: 9, color: colors.textMuted, textTransform: 'uppercase' },
  sessionName: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  sessionMeta: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  sessionDetail: {
    paddingLeft: 52,
    paddingBottom: spacing.sm,
    gap: 4,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  detailName: { ...typography.small, color: colors.textMuted, flex: 1 },
  detailSets: { ...typography.small, color: colors.text, fontFamily: fonts.medium },
  photoHint: { ...typography.small, color: colors.textMuted, marginBottom: spacing.md },
  poseRow: { flexDirection: 'row', gap: spacing.sm },
  poseBtn: { flex: 1, paddingHorizontal: spacing.sm },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoCard: { width: '31%' },
  photo: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoInfo: { marginTop: 4 },
  photoPose: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold, fontSize: 11 },
  photoDate: { ...typography.small, color: colors.textFaint, fontSize: 10 },
});
