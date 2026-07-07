import React, { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Avatar } from '../../../../components/Avatar';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Card';
import { EmptyState } from '../../../../components/EmptyState';
import { LoadingScreen } from '../../../../components/LoadingScreen';
import { ScreenContainer } from '../../../../components/ScreenContainer';
import { TextField } from '../../../../components/TextField';
import { ConsistencyMap } from '../../../../components/ConsistencyMap';
import { LineChart } from '../../../../components/LineChart';
import { WeightChart } from '../../../../components/WeightChart';
import { getCheckInsForClient } from '../../../../lib/firestore/checkins';
import {
  createHabit,
  deleteHabit,
  getHabitLogsForClient,
  getHabitsForClient,
} from '../../../../lib/firestore/habits';
import { getMeasurementsForClient } from '../../../../lib/firestore/measurements';
import { getActiveNutritionPlanForClient } from '../../../../lib/firestore/nutrition';
import { getProgressPhotosForClient } from '../../../../lib/firestore/progressPhotos';
import { getRoutinesForClient } from '../../../../lib/firestore/routines';
import { getWeightLogsForClient } from '../../../../lib/firestore/weightLogs';
import { getWorkoutLogsForClient } from '../../../../lib/firestore/workoutLogs';
import { buildClientReportHtml } from '../../../../lib/report';
import { trainingDays, weeklyActivity } from '../../../../lib/stats';
import { getUserProfile, updateClientStatus } from '../../../../lib/firestore/users';
import { fonts, colors, radius, spacing, typography } from '../../../../lib/theme';
import {
  CHECKIN_FIELDS,
  CLIENT_STATUSES,
  CLIENT_STATUS_LABEL,
  type BodyMeasurement,
  type ClientStatus,
  type NutritionPlan,
  type ProgressPhoto,
  type Routine,
  type Habit,
  type HabitLog,
  type UserProfile,
  type WeeklyCheckIn,
  type WeightLog,
  type WorkoutLog,
} from '../../../../lib/types';

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<UserProfile | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [nutritionPlan, setNutritionPlan] = useState<NutritionPlan | null>(null);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [checkIns, setCheckIns] = useState<WeeklyCheckIn[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [newHabit, setNewHabit] = useState('');
  const [addingHabit, setAddingHabit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let cancelled = false;
      (async () => {
        const [clientData, routineData, weightData, workoutData, measurementData, planData, photoData, checkInData, habitData, habitLogData] =
          await Promise.all([
            getUserProfile(id),
            getRoutinesForClient(id),
            getWeightLogsForClient(id),
            getWorkoutLogsForClient(id),
            getMeasurementsForClient(id),
            getActiveNutritionPlanForClient(id),
            getProgressPhotosForClient(id),
            getCheckInsForClient(id),
            getHabitsForClient(id),
            getHabitLogsForClient(id),
          ]);
        if (cancelled) return;
        setClient(clientData);
        setRoutines(routineData);
        setWeightLogs(weightData);
        setWorkoutLogs(workoutData);
        setMeasurements(measurementData);
        setNutritionPlan(planData);
        setPhotos(photoData);
        setCheckIns(checkInData);
        setHabits(habitData);
        setHabitLogs(habitLogData);
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [id])
  );

  const handleAddHabit = async () => {
    if (!id || !client) return;
    const name = newHabit.trim();
    if (!name) return;
    setAddingHabit(true);
    try {
      await createHabit({ trainerId: client.trainerId ?? '', clientId: id, name });
      setNewHabit('');
      setHabits(await getHabitsForClient(id));
    } finally {
      setAddingHabit(false);
    }
  };

  const handleDeleteHabit = async (habitId: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== habitId));
    await deleteHabit(habitId);
  };

  const handleSetStatus = async (status: ClientStatus) => {
    if (!id || !client) return;
    setClient({ ...client, status });
    await updateClientStatus(id, status);
  };

  if (loading) return <LoadingScreen />;
  if (!client) return <EmptyState title="Cliente no encontrado" />;

  const activeRoutine = routines.find((r) => r.active);
  const currentStatus: ClientStatus = client.status ?? 'active';
  const waistPoints = measurements
    .filter((m) => m.waistCm !== undefined)
    .map((m) => ({ date: m.date, value: m.waistCm as number }));

  const handleGenerateReport = async () => {
    if (!client) return;
    setGeneratingReport(true);
    try {
      const html = buildClientReportHtml({
        client,
        routine: activeRoutine ?? null,
        weightLogs,
        workoutLogs,
        measurements,
        nutritionPlan,
      });

      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
        }
      }
    } finally {
      setGeneratingReport(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Avatar name={client.name} photoURL={client.photoURL} size={64} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{client.name}</Text>
          <Text style={styles.email}>{client.email}</Text>
          {client.level ? (
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{client.level}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {client.bio ? <Text style={styles.bio}>{client.bio}</Text> : null}

      <View style={styles.statusRow}>
        {CLIENT_STATUSES.map((s) => (
          <Pressable
            key={s}
            onPress={() => handleSetStatus(s)}
            style={[styles.statusChip, currentStatus === s && styles.statusChipActive]}
          >
            <Text style={[styles.statusText, currentStatus === s && styles.statusTextActive]}>
              {CLIENT_STATUS_LABEL[s]}
            </Text>
          </Pressable>
        ))}
      </View>

      {client.goal || client.targetWeightKg ? (
        <Card style={styles.section}>
          {client.goal ? (
            <>
              <Text style={styles.miniLabel}>Objetivo</Text>
              <Text style={styles.miniValue}>{client.goal}</Text>
            </>
          ) : null}
          {client.targetWeightKg ? (
            <Text style={[styles.miniValue, { marginTop: client.goal ? spacing.sm : 0 }]}>
              Peso objetivo: {client.targetWeightKg} kg
            </Text>
          ) : null}
        </Card>
      ) : null}

      <Button
        title="Generar informe PDF"
        variant="secondary"
        onPress={handleGenerateReport}
        loading={generatingReport}
        style={{ marginBottom: spacing.md }}
      />

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Rutina asignada</Text>
        {activeRoutine ? (
          <>
            <Text style={styles.routineName}>{activeRoutine.name}</Text>
            <Text style={styles.routineMeta}>
              {activeRoutine.days.length} día(s) de entrenamiento
            </Text>
          </>
        ) : (
          <Text style={styles.mutedText}>Este cliente no tiene una rutina activa.</Text>
        )}
        <Button
          title={activeRoutine ? 'Editar rutina' : 'Crear rutina'}
          variant="secondary"
          onPress={() => router.push(`/(trainer)/clients/${id}/routine`)}
          style={{ marginTop: spacing.md }}
        />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Plan nutricional</Text>
        {nutritionPlan ? (
          <>
            <Text style={styles.routineName}>{nutritionPlan.name}</Text>
            <Text style={styles.routineMeta}>
              {nutritionPlan.dailyCalories} kcal · P{nutritionPlan.proteinG}g C
              {nutritionPlan.carbsG}g G{nutritionPlan.fatG}g
            </Text>
          </>
        ) : (
          <Text style={styles.mutedText}>Este cliente no tiene un plan nutricional activo.</Text>
        )}
        <Button
          title={nutritionPlan ? 'Editar plan' : 'Crear plan'}
          variant="secondary"
          onPress={() => router.push(`/(trainer)/clients/${id}/nutrition`)}
          style={{ marginTop: spacing.md }}
        />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Evolución del peso</Text>
        <WeightChart logs={weightLogs} />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Medidas corporales — cintura</Text>
        <LineChart
          points={waistPoints}
          unit="cm"
          emptyMessage="El cliente todavía no ha registrado al menos dos medidas de cintura."
        />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Fotos de progreso</Text>
        {photos.length === 0 ? (
          <Text style={styles.mutedText}>El cliente todavía no ha subido fotos.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
            {photos.slice(0, 12).map((p) => (
              <View key={p.id} style={styles.photoItem}>
                <Image source={{ uri: p.imageURL }} style={styles.photo} resizeMode="cover" />
                <Text style={styles.photoDate}>
                  {new Date(p.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Hábitos diarios</Text>
        <Text style={styles.mutedText}>
          Asigna hábitos que el alumno marcará cada día desde su inicio.
        </Text>
        {habits.map((h) => {
          const weekCount = habitLogs.filter((l) => l.habitId === h.id).length;
          return (
            <View key={h.id} style={styles.habitManageRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.logTitle}>{h.name}</Text>
                <Text style={styles.logDate}>{weekCount}/7 días esta semana</Text>
              </View>
              <Pressable onPress={() => handleDeleteHabit(h.id)} hitSlop={6}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
          );
        })}
        <View style={styles.habitAddRow}>
          <TextField
            placeholder="Ej: Dormir 8 horas"
            value={newHabit}
            onChangeText={setNewHabit}
            style={{ flex: 1, marginBottom: 0 }}
          />
          <Button
            title="Añadir"
            variant="secondary"
            onPress={handleAddHabit}
            loading={addingHabit}
            disabled={!newHabit.trim()}
          />
        </View>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Actividad (12 semanas)</Text>
        <Text style={styles.mutedText}>Cada punto dorado es un día entrenado.</Text>
        <View style={{ marginTop: spacing.sm }}>
          <ConsistencyMap days={trainingDays(workoutLogs)} />
        </View>
        <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Volumen semanal (kg)</Text>
        <LineChart
          points={weeklyActivity(workoutLogs).map((w) => ({
            date: w.weekStart,
            value: w.volumeKg,
          }))}
          unit="kg"
          emptyMessage="Sin entrenamientos con peso registrados todavía."
        />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Check-ins semanales</Text>
        {checkIns.length === 0 ? (
          <Text style={styles.mutedText}>Todavía no ha enviado ningún check-in.</Text>
        ) : (
          checkIns.slice(0, 4).map((c) => (
            <View key={c.id} style={styles.checkInRow}>
              <Text style={styles.checkInDate}>
                Semana del{' '}
                {new Date(c.weekStart).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                })}
              </Text>
              <View style={styles.checkInScores}>
                {CHECKIN_FIELDS.map((f) => (
                  <View key={f.key} style={styles.checkInScore}>
                    <Text style={styles.checkInScoreValue}>{c[f.key]}</Text>
                    <Text style={styles.checkInScoreLabel}>{f.label.split(' ')[0]}</Text>
                  </View>
                ))}
              </View>
              {c.notes ? <Text style={styles.checkInNotes}>“{c.notes}”</Text> : null}
            </View>
          ))
        )}
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Historial de entrenamientos</Text>
        {workoutLogs.length === 0 ? (
          <Text style={styles.mutedText}>Todavía no ha registrado entrenamientos.</Text>
        ) : (
          workoutLogs.slice(0, 10).map((log) => (
            <Pressable
              key={log.id}
              onPress={() => router.push(`/(trainer)/clients/${id}/session?logId=${log.id}`)}
            >
              <View style={styles.logRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.logTitle}>{log.dayName}</Text>
                  <Text style={styles.logDate}>
                    {new Date(log.date).toLocaleDateString('es-ES')}
                  </Text>
                </View>
                <Text style={styles.logExercises}>{log.exercises.length} ejercicios</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </View>
            </Pressable>
          ))
        )}
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  name: { ...typography.h2, color: colors.text },
  email: { ...typography.small, color: colors.textMuted },
  levelBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  levelBadgeText: { ...typography.label, color: colors.primary, textTransform: 'uppercase' },
  bio: {
    ...typography.body,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginBottom: spacing.md,
  },
  statusRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statusChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  statusChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  statusTextActive: { color: colors.onPrimary },
  miniLabel: { ...typography.label, color: colors.textMuted, textTransform: 'uppercase' },
  miniValue: { ...typography.body, color: colors.text, marginTop: 2 },
  section: { marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  routineName: { ...typography.body, color: colors.text, fontFamily: fonts.heading, },
  routineMeta: { ...typography.small, color: colors.textMuted },
  mutedText: { ...typography.small, color: colors.textFaint },
  habitManageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  habitAddRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  checkInRow: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  checkInDate: {
    ...typography.small,
    color: colors.text,
    fontFamily: fonts.semiBold,
    marginBottom: spacing.xs,
  },
  checkInScores: { flexDirection: 'row', gap: spacing.sm },
  checkInScore: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkInScoreValue: { ...typography.h3, color: colors.primaryBright },
  checkInScoreLabel: { fontSize: 10, color: colors.textMuted, fontFamily: fonts.medium },
  checkInNotes: {
    ...typography.small,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  photoStrip: { marginTop: spacing.xs },
  photoItem: { marginRight: spacing.sm, alignItems: 'center' },
  photo: {
    width: 96,
    height: 128,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoDate: { ...typography.small, color: colors.textFaint, marginTop: 4, fontSize: 11 },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  logTitle: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, },
  logDate: { ...typography.small, color: colors.textFaint },
  logExercises: { ...typography.small, color: colors.textMuted },
});
