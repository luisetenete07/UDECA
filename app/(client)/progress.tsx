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
import { createMeasurement, getMeasurementsForClient } from '../../lib/firestore/measurements';
import {
  createProgressPhoto,
  getProgressPhotosForClient,
} from '../../lib/firestore/progressPhotos';
import { createWeightLog, getWeightLogsForClient } from '../../lib/firestore/weightLogs';
import { pickProgressPhoto } from '../../lib/image';
import { getWorkoutLogsForClient } from '../../lib/firestore/workoutLogs';
import { topExercises, trainingDays, weeklyActivity } from '../../lib/stats';
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

type Tab = 'weight' | 'measurements' | 'photos' | 'activity';

export default function ProgressScreen() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('weight');
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
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
    } finally {
      setSaving(false);
    }
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
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo subir la foto.';
      if (Platform.OS !== 'web') Alert.alert('Foto de progreso', message);
    } finally {
      setUploadingPose(null);
    }
  };

  if (loading) return <LoadingScreen />;

  const waistPoints = measurements
    .filter((m) => m.waistCm !== undefined)
    .map((m) => ({ date: m.date, value: m.waistCm as number }));

  return (
    <ScreenContainer>
      <Text style={styles.title}>Mi progreso</Text>

      <View style={styles.tabs}>
        <TabButton label="Peso" active={tab === 'weight'} onPress={() => setTab('weight')} />
        <TabButton
          label="Medidas"
          active={tab === 'measurements'}
          onPress={() => setTab('measurements')}
        />
        <TabButton label="Fotos" active={tab === 'photos'} onPress={() => setTab('photos')} />
        <TabButton
          label="Actividad"
          active={tab === 'activity'}
          onPress={() => setTab('activity')}
        />
      </View>

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
                </View>
              ))
            )}
          </Card>
        </>
      ) : tab === 'activity' ? (
        <>
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Constancia (12 semanas)</Text>
            <Text style={styles.photoHint}>
              Cada punto dorado es un día entrenado. Que no se apague la llama.
            </Text>
            <ConsistencyMap days={trainingDays(workoutLogs)} />
          </Card>

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
            <Text style={styles.sectionTitle}>Tus ejercicios más entrenados</Text>
            {topExercises(workoutLogs).length === 0 ? (
              <EmptyState title="Todavía no hay entrenamientos registrados" />
            ) : (
              topExercises(workoutLogs).map((ex, i) => (
                <View key={ex.name} style={styles.logRow}>
                  <Text style={styles.logValue}>
                    {i + 1}. {ex.name}
                  </Text>
                  <Text style={styles.logDate}>{ex.count} sesiones</Text>
                </View>
              ))
            )}
          </Card>
        </>
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

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.md },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.xs,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabButton: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
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
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  logValue: { ...typography.body, color: colors.text, fontFamily: fonts.heading, flex: 1, marginRight: spacing.sm },
  logDate: { ...typography.small, color: colors.textMuted },
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
