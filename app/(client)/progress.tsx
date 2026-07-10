import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import {
  createMeasurement,
  deleteMeasurement,
  getMeasurementsForClient,
} from '../../lib/firestore/measurements';
import {
  createProgressPhoto,
  getProgressPhotosForClient,
} from '../../lib/firestore/progressPhotos';
import { createWeightLog, deleteWeightLog, getWeightLogsForClient } from '../../lib/firestore/weightLogs';
import { pickProgressPhoto } from '../../lib/image';
import { deleteWorkoutLog, getWorkoutLogsForClient } from '../../lib/firestore/workoutLogs';
import { getExercisesForTrainer } from '../../lib/firestore/exercises';
import {
  exerciseProgression,
  isIsometricExercise,
  listExercisesInLogs,
  sessionTotals,
  topExercises,
  trainingDays,
  weeklyActivity,
  workoutsByMonth,
} from '../../lib/stats';
import { ConsistencyMap } from '../../components/ConsistencyMap';
import { fonts, colors, radius, spacing, typography } from '../../lib/theme';
import {
  PHOTO_POSES,
  type BodyMeasurement,
  type PhotoPose,
  type ProgressPhoto,
  type WeightLog,
  type WorkoutLog,
} from '../../lib/types';

type Tab = 'workouts' | 'weight' | 'measurements' | 'photos' | 'exercises';

/** Pone en mayúscula la primera letra (para "julio 2026" → "Julio 2026"). */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function ProgressScreen() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('workouts');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [measureByExercise, setMeasureByExercise] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [weightInput, setWeightInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');
  const [arm, setArm] = useState('');
  const [thigh, setThigh] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPose, setUploadingPose] = useState<PhotoPose | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const [weightData, measurementData, photoData, workoutData] = await Promise.all([
      getWeightLogsForClient(profile.uid),
      getMeasurementsForClient(profile.uid),
      getProgressPhotosForClient(profile.uid),
      getWorkoutLogsForClient(profile.uid),
    ]);
    setWeightLogs(weightData);
    setMeasurements(measurementData);
    setPhotos(photoData);
    setWorkoutLogs(workoutData);
    // Medida actual de cada ejercicio (reps/segundos) desde la biblioteca del
    // coach, para mostrar bien los isométricos aunque el registro sea antiguo.
    if (profile.trainerId) {
      getExercisesForTrainer(profile.trainerId)
        .then((library) => {
          const map: Record<string, string> = {};
          for (const ex of library) map[ex.id] = ex.measure ?? 'reps';
          setMeasureByExercise(map);
        })
        .catch(() => {});
    }
    setLoading(false);
  }, [profile]);

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

  const handleAddMeasurement = async () => {
    if (!profile) return;
    const values = { chestCm: chest, waistCm: waist, hipsCm: hips, armCm: arm, thighCm: thigh };
    const hasAny = Object.values(values).some((v) => v.trim() !== '');
    if (!hasAny) {
      setError('Rellena al menos una medida.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createMeasurement({
        trainerId: profile.trainerId ?? '',
        clientId: profile.uid,
        date: Date.now(),
        chestCm: chest ? Number(chest) : undefined,
        waistCm: waist ? Number(waist) : undefined,
        hipsCm: hips ? Number(hips) : undefined,
        armCm: arm ? Number(arm) : undefined,
        thighCm: thigh ? Number(thigh) : undefined,
      });
      setChest('');
      setWaist('');
      setHips('');
      setArm('');
      setThigh('');
      await load();
      showToast('Medidas guardadas');
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

  const handleDeleteMeasurement = async (id: string) => {
    if (!(await confirmDelete('¿Borrar esta medición?'))) return;
    setMeasurements((prev) => prev.filter((m) => m.id !== id));
    await deleteMeasurement(id);
    showToast('Medición borrada');
  };

  const handleAddPhoto = async (pose: PhotoPose) => {
    if (!profile) return;
    setUploadingPose(pose);
    try {
      const imageURL = await pickProgressPhoto();
      if (imageURL) {
        await createProgressPhoto({
          trainerId: profile.trainerId ?? '',
          clientId: profile.uid,
          pose,
          imageURL,
          date: Date.now(),
        });
        await load();
        showToast('Foto subida');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo subir la foto.';
      if (Platform.OS !== 'web') Alert.alert('Foto de progreso', message);
    } finally {
      setUploadingPose(null);
    }
  };

  if (loading) return <LoadingScreen />;

  const months = workoutsByMonth(workoutLogs, measureByExercise);
  const toggleSession = (id: string) =>
    setExpandedSessions((prev) => ({ ...prev, [id]: !prev[id] }));

  const waistPoints = measurements
    .filter((m) => m.waistCm !== undefined)
    .map((m) => ({ date: m.date, value: m.waistCm as number }));

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
    <ScreenContainer>
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
        <TabButton
          label="Medidas"
          active={tab === 'measurements'}
          onPress={() => setTab('measurements')}
        />
        <TabButton label="Fotos" active={tab === 'photos'} onPress={() => setTab('photos')} />
      </ScrollView>

      {tab === 'workouts' ? (
        months.length === 0 ? (
          <Card style={styles.section}>
            <EmptyState
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

            {months.map((m) => (
              <Card key={m.key} style={styles.section}>
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
              placeholder="Peso en kg"
              keyboardType="numeric"
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
      ) : tab === 'measurements' ? (
        <>
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Evolución de cintura</Text>
            <LineChart
              points={waistPoints}
              unit="cm"
              emptyMessage="Registra al menos dos medidas de cintura para ver tu evolución."
            />
          </Card>

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Registrar medidas (cm)</Text>
            <View style={styles.row}>
              <TextField
                placeholder="Pecho"
                keyboardType="numeric"
                value={chest}
                onChangeText={setChest}
                style={styles.smallField}
              />
              <TextField
                placeholder="Cintura"
                keyboardType="numeric"
                value={waist}
                onChangeText={setWaist}
                style={styles.smallField}
              />
            </View>
            <View style={styles.row}>
              <TextField
                placeholder="Cadera"
                keyboardType="numeric"
                value={hips}
                onChangeText={setHips}
                style={styles.smallField}
              />
              <TextField
                placeholder="Brazo"
                keyboardType="numeric"
                value={arm}
                onChangeText={setArm}
                style={styles.smallField}
              />
              <TextField
                placeholder="Muslo"
                keyboardType="numeric"
                value={thigh}
                onChangeText={setThigh}
                style={styles.smallField}
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Guardar medidas" onPress={handleAddMeasurement} loading={saving} />
          </Card>

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Historial</Text>
            {measurements.length === 0 ? (
              <EmptyState title="Todavía no has registrado medidas" />
            ) : (
              [...measurements].reverse().map((m) => (
                <View key={m.id} style={styles.logRow}>
                  <Text style={styles.logValue}>
                    {[
                      m.chestCm ? `Pecho ${m.chestCm}` : null,
                      m.waistCm ? `Cintura ${m.waistCm}` : null,
                      m.hipsCm ? `Cadera ${m.hipsCm}` : null,
                      m.armCm ? `Brazo ${m.armCm}` : null,
                      m.thighCm ? `Muslo ${m.thighCm}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <Text style={styles.logDate}>{new Date(m.date).toLocaleDateString('es-ES')}</Text>
                  <Pressable onPress={() => handleDeleteMeasurement(m.id)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={16} color={colors.textFaint} />
                  </Pressable>
                </View>
              ))
            )}
          </Card>
        </>
      ) : tab === 'exercises' ? (
        exercisesInLogs.length === 0 ? (
          <Card style={styles.section}>
            <EmptyState
              title="Aún no hay datos por ejercicio"
              subtitle="Cuando completes entrenamientos verás aquí cómo mejoras en cada ejercicio."
            />
          </Card>
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
        )
      ) : (
        <>
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Añadir foto</Text>
            <Text style={styles.photoHint}>
              Sube fotos de frente, perfil y espalda. Solo tú y tu entrenador las veréis.
            </Text>
            <View style={styles.poseRow}>
              {PHOTO_POSES.map((pose) => (
                <Button
                  key={pose.key}
                  title={pose.label}
                  variant="secondary"
                  onPress={() => handleAddPhoto(pose.key)}
                  loading={uploadingPose === pose.key}
                  style={styles.poseBtn}
                />
              ))}
            </View>
          </Card>

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Galería</Text>
            {photos.length === 0 ? (
              <EmptyState title="Todavía no has subido fotos de progreso" />
            ) : (
              <View style={styles.photoGrid}>
                {photos.map((p) => (
                  <View key={p.id} style={styles.photoCard}>
                    <Image source={{ uri: p.imageURL }} style={styles.photo} resizeMode="cover" />
                    <View style={styles.photoInfo}>
                      <Text style={styles.photoPose}>
                        {PHOTO_POSES.find((x) => x.key === p.pose)?.label ?? p.pose}
                      </Text>
                      <Text style={styles.photoDate}>
                        {new Date(p.date).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </>
      )}
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
  logDate: { ...typography.small, color: colors.textMuted },
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
