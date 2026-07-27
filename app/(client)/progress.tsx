import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { LineChart } from '../../components/LineChart';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { WeightChart } from '../../components/WeightChart';
import { MuscleMap } from '../../components/MuscleMap';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { shareSessionImage } from '../../lib/brandCards';
import { buildClientReportHtml } from '../../lib/report';
import { muscleLoad } from '../../lib/muscles';
import { useAuth } from '../../lib/auth-context';
import { showToast } from '../../components/Toast';
import { createWeightLog, deleteWeightLog, getWeightLogsForClient } from '../../lib/firestore/weightLogs';
import { getCached, setCached } from '../../lib/screenCache';
import { deleteWorkoutLog, getWorkoutLogsForClient } from '../../lib/firestore/workoutLogs';
import { getExercisesForTrainer } from '../../lib/firestore/exercises';
import { getLevelTestsForClient } from '../../lib/firestore/levelTests';
import {
  exerciseProgression,
  exerciseRecord,
  isComboExercise,
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
  const [muscleMode, setMuscleMode] = useState<'session' | 'week'>('week');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});
  // Pinta al instante lo último conocido (caché de sesión) y refresca detrás.
  const cacheKey = `progress-${profile?.uid ?? ''}`;
  const cached = getCached<ProgressData>(cacheKey);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>(cached?.weightLogs ?? []);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>(cached?.workoutLogs ?? []);
  const [measureByExercise, setMeasureByExercise] = useState<Record<string, string>>({});
  const [muscleByExercise, setMuscleByExercise] = useState<Record<string, string>>({});
  const [musclesByExercise, setMusclesByExercise] = useState<
    Record<string, import('../../lib/muscles').MuscleId[]>
  >({});
  const [levelTests, setLevelTests] = useState<import('../../lib/types').LevelTest[]>([]);
  const [loading, setLoading] = useState(cached === undefined);
  const [refreshing, setRefreshing] = useState(false);

  // Borrado de entrenamiento con confirmación por palabra (evita borrados sin querer).
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmWord, setConfirmWord] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [generatingReport, setGeneratingReport] = useState(false);

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
          const musMap: Record<string, import('../../lib/muscles').MuscleId[]> = {};
          for (const ex of library) {
            mmap[ex.id] = ex.measure ?? 'reps';
            gmap[ex.id] = ex.muscleGroup;
            if (ex.muscles && ex.muscles.length > 0) musMap[ex.id] = ex.muscles;
          }
          setMeasureByExercise(mmap);
          setMuscleByExercise(gmap);
          setMusclesByExercise(musMap);
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

  // Informe completo de progreso: usa el MISMO generador que el entrenador,
  // alimentado solo con los datos de esta cuenta (nunca de otros alumnos).
  const handleFullReport = async () => {
    if (!profile || workoutLogs.length === 0) return;
    setGeneratingReport(true);
    try {
      const html = buildClientReportHtml({
        client: profile,
        routine: null,
        weightLogs,
        workoutLogs,
        nutritionPlan: null,
        muscleByExercise,
        measureByExercise,
      });
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
        }
      }
    } catch {
      showToast('No se pudo generar el progreso');
    } finally {
      setGeneratingReport(false);
    }
  };

  // Comparte una sesión concreta del registro mensual como imagen de marca
  // UDECA; si no se puede generar, cae a texto compartible.
  const handleShareSession = async (log: WorkoutLog) => {
    const t = sessionTotals(log.exercises, measureByExercise);
    try {
      const result = await shareSessionImage({
        routineName: log.routineName ?? 'UDECA',
        dayName: log.dayName,
        durationMin: log.durationMin ?? 0,
        sets: t.sets,
        reps: t.reps,
        seconds: t.seconds,
        volumeKg: t.volumeKg,
        streak: 0,
        prCount: 0,
        date: log.date,
      });
      if (result === 'downloaded') showToast('Imagen de la sesión descargada');
      if (result) return;
    } catch {
      // Caemos al texto.
    }
    const parts = [
      `Sesión completada en UDECA: ${log.dayName ?? log.routineName ?? ''}`.trim(),
      log.durationMin ? `${log.durationMin} min` : null,
      `${t.sets} series`,
      t.reps > 0 ? `${t.reps} reps` : null,
      t.seconds > 0 ? `${t.seconds}s isométrico` : null,
      t.volumeKg > 0 ? `${t.volumeKg} kg de volumen` : null,
    ].filter(Boolean);
    const message = `${parts.join(' · ')}\n\nEntreno con UDECA — Universidad de Calistenia`;
    try {
      await Share.share({ message });
    } catch {
      try {
        await navigator.clipboard.writeText(message);
        showToast('Resumen copiado, pégalo donde quieras');
      } catch {
        showToast('No se pudo compartir');
      }
    }
  };

  // Abre el diálogo que pide escribir CONFIRMAR para borrar el entrenamiento.
  const requestDeleteWorkout = (id: string) => {
    setConfirmWord('');
    setDeleteId(id);
  };

  const doDeleteWorkout = async () => {
    if (!deleteId || confirmWord.trim().toUpperCase() !== 'CONFIRMAR') return;
    const id = deleteId;
    setDeleting(true);
    try {
      setWorkoutLogs((prev) => prev.filter((l) => l.id !== id));
      await deleteWorkoutLog(id);
      showToast('Entrenamiento borrado');
      setDeleteId(null);
    } catch (e) {
      await load(); // si falla, recargamos para no perder el registro de la vista
      showToast(e instanceof Error ? e.message : 'No se pudo borrar');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <LoadingScreen />;

  const months = workoutsByMonth(workoutLogs, measureByExercise);
  const toggleSession = (id: string) =>
    setExpandedSessions((prev) => ({ ...prev, [id]: !prev[id] }));

  const comparison = thenVsNow(workoutLogs, weightLogs);

  // Mapa corporal: intensidad por músculo según lo trabajado en la última
  // sesión o en los últimos 7 días. `muscleByExercise` (grupo del ejercicio)
  // refina la clasificación por nombre.
  const groupByEx = muscleByExercise;
  const startOfDayTs = (ts: number) => {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const lastSessionDay = workoutLogs.length > 0 ? startOfDayTs(workoutLogs[0].date) : 0;
  const sessionLogs = workoutLogs.filter((l) => startOfDayTs(l.date) === lastSessionDay);
  const muscleIntensity =
    muscleMode === 'session'
      ? muscleLoad(sessionLogs, undefined, groupByEx, musclesByExercise)
      : muscleLoad(workoutLogs, Date.now() - 7 * 24 * 60 * 60 * 1000, groupByEx, musclesByExercise);
  const muscleHasData = Object.values(muscleIntensity).some((v) => v > 0);

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
  // Récord real del ejercicio, con el formato correcto según su tipo
  // (reps, segundos o reps×lastre). No se infiere de la métrica de la gráfica.
  const progRecord = selExerciseId ? exerciseRecord(workoutLogs, selExerciseId) : null;

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
                        {t.sets > 0 || t.seconds > 0 ? (
                          <Pressable
                            onPress={() => handleShareSession(s)}
                            hitSlop={8}
                            style={styles.sessionShare}
                          >
                            <Ionicons name="share-outline" size={16} color={colors.primary} />
                          </Pressable>
                        ) : null}
                        <Pressable
                          onPress={() => requestDeleteWorkout(s.id)}
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
                            const isCombo = isComboExercise(ex, measureByExercise);
                            const done = ex.sets
                              .filter((st) => st.completed && st.reps)
                              .map(
                                (st) =>
                                  // El combo enseña las dos marcas de la serie.
                                  `${st.reps}${isCombo && st.seconds ? `+${st.seconds}s` : ''}` +
                                  `${st.weight ? `×${st.weight}kg` : ''}`
                              )
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
          <Card style={styles.section}>
            <View style={styles.muscleHeader}>
              <Text style={styles.sectionTitle}>Músculos trabajados</Text>
              <View style={styles.muscleToggle}>
                <Pressable
                  onPress={() => setMuscleMode('session')}
                  style={[styles.muscleTab, muscleMode === 'session' && styles.muscleTabOn]}
                >
                  <Text
                    style={[
                      styles.muscleTabText,
                      muscleMode === 'session' && styles.muscleTabTextOn,
                    ]}
                  >
                    Última sesión
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setMuscleMode('week')}
                  style={[styles.muscleTab, muscleMode === 'week' && styles.muscleTabOn]}
                >
                  <Text
                    style={[
                      styles.muscleTabText,
                      muscleMode === 'week' && styles.muscleTabTextOn,
                    ]}
                  >
                    Semana
                  </Text>
                </Pressable>
              </View>
            </View>
            <MuscleMap intensity={muscleIntensity} hasData={muscleHasData} />
          </Card>

          {/* Informe completo (el mismo que genera el entrenador), pero solo
              con los datos de esta cuenta. */}
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Tu progreso completo</Text>
            <Text style={styles.photoHint}>
              Genera una tabla con tus entrenamientos por mes, series, repeticiones,
              isométricos, volumen y tus mejores marcas. Puedes guardarla o compartirla.
            </Text>
            <Button
              title="Ver progreso completo"
              onPress={handleFullReport}
              loading={generatingReport}
              disabled={workoutLogs.length === 0}
              style={{ marginTop: spacing.md }}
            />
          </Card>
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
                  icon="stats-chart-outline"
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
                {progRecord ? (
                  <View style={styles.recordPill}>
                    <Ionicons name="trophy" size={13} color={colors.primary} />
                    <Text style={styles.recordText}>Récord: {progRecord.label}</Text>
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

      {/* Borrar entrenamiento: hay que escribir CONFIRMAR (evita borrados por error) */}
      <Modal
        visible={!!deleteId}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteId(null)}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Ionicons name="trash-outline" size={24} color={colors.danger} />
            </View>
            <Text style={styles.confirmTitle}>Borrar entrenamiento</Text>
            <Text style={styles.confirmText}>
              Esta acción no se puede deshacer. Para confirmar, escribe{' '}
              <Text style={styles.confirmWordHint}>CONFIRMAR</Text> abajo.
            </Text>
            <TextInput
              value={confirmWord}
              onChangeText={setConfirmWord}
              placeholder="CONFIRMAR"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.confirmInput}
            />
            <Button
              title="Borrar entrenamiento"
              variant="danger"
              onPress={doDeleteWorkout}
              loading={deleting}
              disabled={confirmWord.trim().toUpperCase() !== 'CONFIRMAR'}
              style={{ marginTop: spacing.md }}
            />
            <Button
              title="Cancelar"
              variant="ghost"
              onPress={() => setDeleteId(null)}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </View>
      </Modal>
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
  const color = neutral || flat ? colors.textMuted : delta > 0 ? colors.success : colors.danger;
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
  muscleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  muscleToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  muscleTab: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.sm - 2 },
  muscleTabOn: { backgroundColor: colors.primary },
  muscleTabText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold, fontSize: 12 },
  muscleTabTextOn: { color: colors.onPrimary },
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
  sessionShare: { padding: spacing.xs },
  sessionDelete: { padding: spacing.xs },
  confirmBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: spacing.lg,
  },
  confirmCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  confirmIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.dangerMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  confirmTitle: { ...typography.h3, color: colors.text, textAlign: 'center' },
  confirmText: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  confirmWordHint: { color: colors.danger, fontFamily: fonts.heading },
  confirmInput: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
    minHeight: 48,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.semiBold,
    letterSpacing: 1,
    textAlign: 'center',
  },
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
