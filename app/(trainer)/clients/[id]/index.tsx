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
import { showToast } from '../../../../components/Toast';
import { ConsistencyMap } from '../../../../components/ConsistencyMap';
import { LineChart } from '../../../../components/LineChart';
import { WeightChart } from '../../../../components/WeightChart';
import { getCheckInsForClient } from '../../../../lib/firestore/checkins';
import { getExercisesForTrainer } from '../../../../lib/firestore/exercises';
import {
  createHabit,
  deleteHabit,
  getHabitLogsForClient,
  getHabitsForClient,
} from '../../../../lib/firestore/habits';
import { getActiveNutritionPlanForClient } from '../../../../lib/firestore/nutrition';
import { getProgressPhotosForClient } from '../../../../lib/firestore/progressPhotos';
import { getRoutinesForClient } from '../../../../lib/firestore/routines';
import { getWeightLogsForClient } from '../../../../lib/firestore/weightLogs';
import { getWorkoutLogsForClient } from '../../../../lib/firestore/workoutLogs';
import { getCoachNote, saveCoachNote } from '../../../../lib/firestore/coachNotes';
import { createPayment } from '../../../../lib/firestore/payments';
import { notifyUser } from '../../../../lib/notifications';
import { buildClientReportHtml } from '../../../../lib/report';
import { trainingDays, weeklyVolume } from '../../../../lib/stats';
import {
  clearClientNextPayment,
  getUserProfile,
  removeClientFromTrainer,
  updateClientBilling,
  updateClientPaymentStatus,
  updateClientStatus,
} from '../../../../lib/firestore/users';
import { useAuth } from '../../../../lib/auth-context';
import { fonts, colors, radius, spacing, typography } from '../../../../lib/theme';
import {
  CHECKIN_FIELDS,
  CLIENT_STATUSES,
  CLIENT_STATUS_LABEL,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  type PaymentStatus,
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

/** Suma `n` meses a un timestamp (Date gestiona el desbordamiento de mes). */
function addMonths(ts: number, n: number): number {
  const d = new Date(ts);
  d.setMonth(d.getMonth() + n);
  return d.getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;
const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const [client, setClient] = useState<UserProfile | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [muscleByExercise, setMuscleByExercise] = useState<Record<string, string>>({});
  const [measureByExercise, setMeasureByExercise] = useState<Record<string, string>>({});
  const [nutritionPlan, setNutritionPlan] = useState<NutritionPlan | null>(null);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [checkIns, setCheckIns] = useState<WeeklyCheckIn[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [newHabit, setNewHabit] = useState('');
  const [addingHabit, setAddingHabit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [feeInput, setFeeInput] = useState('');
  const [extendDaysInput, setExtendDaysInput] = useState('');
  const [remindingPayment, setRemindingPayment] = useState(false);
  const [paymentReminderSent, setPaymentReminderSent] = useState(false);
  const [coachNote, setCoachNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id || !profile) return;
      let cancelled = false;
      const uid = profile.uid;
      (async () => {
        try {
        const [clientData, routineData, weightData, workoutData, planData, photoData, checkInData, habitData, habitLogData, noteData, exerciseData] =
          await Promise.all([
            getUserProfile(id),
            getRoutinesForClient(id, uid),
            getWeightLogsForClient(id, uid),
            getWorkoutLogsForClient(id, uid),
            getActiveNutritionPlanForClient(id, uid),
            getProgressPhotosForClient(id, uid),
            getCheckInsForClient(id, uid),
            getHabitsForClient(id, uid),
            getHabitLogsForClient(id, uid),
            getCoachNote(id),
            getExercisesForTrainer(uid),
          ]);
        if (cancelled) return;
        setClient(clientData);
        setMuscleByExercise(
          Object.fromEntries(exerciseData.map((e) => [e.id, e.muscleGroup]))
        );
        setMeasureByExercise(
          Object.fromEntries(exerciseData.map((e) => [e.id, e.measure ?? 'reps']))
        );
        setCoachNote(noteData);
        setFeeInput(clientData?.monthlyFeeEur ? String(clientData.monthlyFeeEur) : '');
        setRoutines(routineData);
        setWeightLogs(weightData);
        setWorkoutLogs(workoutData);
        setNutritionPlan(planData);
        setPhotos(photoData);
        setCheckIns(checkInData);
        setHabits(habitData);
        setHabitLogs(habitLogData);
        } catch (e) {
          if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [id, profile])
  );

  const handleAddHabit = async () => {
    if (!id || !client) return;
    const name = newHabit.trim();
    if (!name) return;
    setAddingHabit(true);
    try {
      await createHabit({ trainerId: client.trainerId ?? '', clientId: id, name });
      setNewHabit('');
      setHabits(await getHabitsForClient(id, profile?.uid));
      showToast('Hábito añadido');
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

  const handleSetPayment = async (paymentStatus: PaymentStatus) => {
    if (!id || !client) return;
    setClient({ ...client, paymentStatus });
    await updateClientPaymentStatus(id, paymentStatus);
  };

  const handleSaveFee = async () => {
    if (!id || !client) return;
    const value = Number(feeInput.replace(',', '.'));
    const monthlyFeeEur = Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
    setClient({ ...client, monthlyFeeEur });
    await updateClientBilling(id, { monthlyFeeEur });
  };

  // Registra el pago: marca "Pagado" y empuja la fecha un mes desde la última
  // renovación (o desde hoy si ya venció). Un solo toque = cobro al día.
  const handleRegisterPayment = async () => {
    if (!id || !client || !profile) return;
    const base =
      client.nextPaymentDate && client.nextPaymentDate > Date.now()
        ? client.nextPaymentDate
        : Date.now();
    const nextPaymentDate = addMonths(base, 1);
    setClient({ ...client, paymentStatus: 'paid', nextPaymentDate });
    await updateClientBilling(id, { paymentStatus: 'paid', nextPaymentDate });
    // Registro del cobro para el historial de ingresos (con la cuota actual).
    createPayment({
      trainerId: profile.uid,
      clientId: id,
      amountEur: client.monthlyFeeEur ?? 0,
      date: Date.now(),
    }).catch(() => {});
    showToast('Pago registrado · próxima renovación en 1 mes');
  };

  const handleSaveNote = async () => {
    if (!id || !profile) return;
    await saveCoachNote(profile.uid, id, coachNote.trim());
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  };

  // Añade N días personalizados a la fecha del próximo pago.
  const handleExtendDays = async () => {
    if (!id || !client) return;
    const days = parseInt(extendDaysInput, 10);
    if (!days || days <= 0) return;
    const base =
      client.nextPaymentDate && client.nextPaymentDate > Date.now()
        ? client.nextPaymentDate
        : Date.now();
    const nextPaymentDate = base + days * DAY_MS;
    setClient({ ...client, nextPaymentDate });
    setExtendDaysInput('');
    await updateClientBilling(id, { nextPaymentDate });
    showToast(`+${days} días · próximo pago ${fmtDate(nextPaymentDate)}`);
  };

  const handleClearNextPayment = async () => {
    if (!id || !client) return;
    const { nextPaymentDate, ...rest } = client;
    setClient(rest as UserProfile);
    await clearClientNextPayment(id);
  };

  const handleRemindPayment = async () => {
    if (!id || !client) return;
    setRemindingPayment(true);
    try {
      await notifyUser(
        id,
        'Recordatorio de pago',
        `Hola ${client.name.split(' ')[0]}, tienes un pago pendiente de tu suscripción. ¡Gracias!`
      );
      setPaymentReminderSent(true);
      showToast('Recordatorio de pago enviado');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo enviar');
    } finally {
      setRemindingPayment(false);
    }
  };

  const handleRemoveFromGroup = async () => {
    if (!id) return;
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    setRemoving(true);
    try {
      await removeClientFromTrainer(id);
      showToast('Alumno sacado de tu grupo');
      router.replace('/(trainer)/clients');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo sacar al alumno');
      setRemoving(false);
      setConfirmRemove(false);
    }
  };

  if (loading) return <LoadingScreen />;
  if (loadError) {
    return (
      <ScreenContainer>
        <EmptyState title="No se pudo cargar el cliente" subtitle={loadError} />
      </ScreenContainer>
    );
  }
  if (!client) return <EmptyState title="Cliente no encontrado" />;

  const activeRoutine = routines.find((r) => r.active);
  const currentStatus: ClientStatus = client.status ?? 'active';

  const weekly = weeklyVolume(workoutLogs, muscleByExercise);
  const isoTotals = weekly.reduce(
    (acc, w) => ({
      push: acc.push + w.isoPushSeconds,
      pull: acc.pull + w.isoPullSeconds,
      total: acc.total + w.isoSeconds,
    }),
    { push: 0, pull: 0, total: 0 }
  );
  const isoOther = Math.max(0, isoTotals.total - isoTotals.push - isoTotals.pull);

  const handleGenerateReport = async () => {
    if (!client) return;
    setGeneratingReport(true);
    try {
      const html = buildClientReportHtml({
        client,
        routine: activeRoutine ?? null,
        weightLogs,
        workoutLogs,
        nutritionPlan,
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

      <Card style={styles.section}>
        <View style={styles.titleRow}>
          <Ionicons name="card-outline" size={16} color={colors.primary} />
          <Text style={styles.sectionTitle}>Pagos</Text>
        </View>

        <Text style={styles.paymentLabel}>Estado de pago</Text>
        <View style={styles.paymentRow}>
          {PAYMENT_STATUSES.map((p) => {
            const active = client.paymentStatus === p;
            const tone = PAYMENT_STATUS_TONE[p];
            return (
              <Pressable
                key={p}
                onPress={() => handleSetPayment(p)}
                style={[
                  styles.payChip,
                  active && styles.payChipActive,
                  active && tone === 'good' && styles.payGood,
                  active && tone === 'warn' && styles.payWarn,
                  active && tone === 'bad' && styles.payBad,
                ]}
              >
                <Text style={[styles.payChipText, active && styles.payChipTextActive]}>
                  {PAYMENT_STATUS_LABEL[p]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.paymentLabel}>Cuota mensual</Text>
        <View style={styles.feeRow}>
          <TextField
            value={feeInput}
            onChangeText={setFeeInput}
            onBlur={handleSaveFee}
            onEndEditing={handleSaveFee}
            keyboardType="number-pad"
            placeholder="0"
            style={styles.feeField}
          />
          <Text style={styles.euroLabel}>€ / mes</Text>
        </View>

        <Text style={styles.paymentLabel}>Próximo pago</Text>
        <View style={styles.nextPayRow}>
          <Ionicons
            name="calendar-outline"
            size={16}
            color={
              client.nextPaymentDate && client.nextPaymentDate < Date.now()
                ? colors.danger
                : colors.primary
            }
          />
          <Text
            style={[
              styles.nextPayText,
              client.nextPaymentDate != null &&
                client.nextPaymentDate < Date.now() &&
                styles.nextPayOverdue,
            ]}
          >
            {client.nextPaymentDate
              ? `${fmtDate(client.nextPaymentDate)}${
                  client.nextPaymentDate < Date.now() ? ' · vencido' : ''
                }`
              : 'Sin fecha establecida'}
          </Text>
        </View>

        <Button
          title="Registrar pago (renueva +1 mes)"
          onPress={handleRegisterPayment}
          style={{ marginTop: spacing.sm }}
        />
        <View style={styles.payBtnRow}>
          <TextField
            value={extendDaysInput}
            onChangeText={setExtendDaysInput}
            keyboardType="number-pad"
            placeholder="Días"
            style={styles.daysField}
          />
          <Button
            title="+ Añadir días"
            variant="secondary"
            onPress={handleExtendDays}
            disabled={!(parseInt(extendDaysInput, 10) > 0)}
            style={{ flex: 1 }}
          />
          {client.nextPaymentDate ? (
            <Pressable onPress={handleClearNextPayment} style={styles.clearDateBtn} hitSlop={6}>
              <Ionicons name="calendar-outline" size={16} color={colors.danger} />
              <Ionicons name="close" size={12} color={colors.danger} style={styles.clearDateX} />
            </Pressable>
          ) : null}
        </View>

        {client.paymentStatus === 'pending' || client.paymentStatus === 'overdue' ? (
          <Button
            title={paymentReminderSent ? 'Recordatorio enviado ✓' : 'Recordar pago al alumno'}
            variant="secondary"
            onPress={handleRemindPayment}
            loading={remindingPayment}
            disabled={paymentReminderSent}
            style={{ marginTop: spacing.sm }}
          />
        ) : null}
      </Card>

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

      <Card style={styles.section}>
        <View style={styles.titleRow}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.primary} />
          <Text style={styles.sectionTitle}>Notas privadas</Text>
        </View>
        <Text style={styles.mutedText}>Solo tú las ves (lesiones, preferencias, objetivos…).</Text>
        <TextField
          value={coachNote}
          onChangeText={setCoachNote}
          onBlur={handleSaveNote}
          placeholder="Escribe aquí tus notas sobre este alumno..."
          multiline
          numberOfLines={4}
          style={{ height: 96, textAlignVertical: 'top', marginTop: spacing.sm, marginBottom: 0 }}
        />
        {noteSaved ? <Text style={styles.confirmSavedText}>Nota guardada</Text> : null}
      </Card>

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
          points={weekly.map((w) => ({ date: w.weekStart, value: w.volumeKg }))}
          unit="kg"
          emptyMessage="Sin entrenamientos con peso registrados todavía."
        />

        <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>
          Isométricos: segundos por semana
        </Text>
        <Text style={styles.mutedText}>
          Segundos totales de aguante (ejercicios por tiempo), separados por
          empuje y tirón.
        </Text>
        <View style={styles.isoTotalsRow}>
          <View style={styles.isoStat}>
            <Text style={styles.isoStatValue}>{isoTotals.push.toLocaleString('es-ES')}s</Text>
            <Text style={styles.isoStatLabel}>Empuje</Text>
          </View>
          <View style={styles.isoStat}>
            <Text style={styles.isoStatValue}>{isoTotals.pull.toLocaleString('es-ES')}s</Text>
            <Text style={styles.isoStatLabel}>Tirón</Text>
          </View>
          <View style={styles.isoStat}>
            <Text style={styles.isoStatValue}>{isoOther.toLocaleString('es-ES')}s</Text>
            <Text style={styles.isoStatLabel}>Otros</Text>
          </View>
        </View>
        <LineChart
          points={weekly.map((w) => ({ date: w.weekStart, value: w.isoSeconds }))}
          unit="s"
          emptyMessage="Sin ejercicios isométricos (por segundos) registrados todavía."
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

      <Button
        title="Generar informe PDF"
        onPress={handleGenerateReport}
        loading={generatingReport}
        style={{ marginBottom: spacing.md }}
      />

      <Card style={[styles.section, styles.dangerZone]}>
        <Text style={styles.sectionTitle}>Gestión del alumno</Text>
        <Text style={styles.mutedText}>
          Sácalo de tu grupo para que deje de aparecer en tus clientes. No se
          borra su cuenta ni su historial; podrá vincularse a otro entrenador
          con un código.
        </Text>
        {confirmRemove ? (
          <Text style={styles.confirmText}>
            ¿Seguro? Pulsa de nuevo para confirmar.
          </Text>
        ) : null}
        <Button
          title={confirmRemove ? 'Confirmar: sacar del grupo' : 'Sacar del grupo'}
          variant="danger"
          onPress={handleRemoveFromGroup}
          loading={removing}
          style={{ marginTop: spacing.md }}
        />
        {confirmRemove ? (
          <Button
            title="Cancelar"
            variant="secondary"
            onPress={() => setConfirmRemove(false)}
            style={{ marginTop: spacing.sm }}
          />
        ) : null}
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
  paymentLabel: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  paymentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  feeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  feeField: { width: 110, marginBottom: 0 },
  euroLabel: { ...typography.body, color: colors.textMuted, fontFamily: fonts.semiBold },
  nextPayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nextPayText: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  nextPayOverdue: { color: colors.danger },
  payBtnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  daysField: { width: 76, marginBottom: 0, textAlign: 'center' },
  clearDateBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  clearDateX: { marginLeft: -3, marginTop: -8 },
  payChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  payChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  payGood: { backgroundColor: '#2E7D5B', borderColor: '#2E7D5B' },
  payWarn: { backgroundColor: '#C9902B', borderColor: '#C9902B' },
  payBad: { backgroundColor: colors.danger, borderColor: colors.danger },
  payChipText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold, fontSize: 12 },
  payChipTextActive: { color: colors.white },
  miniLabel: { ...typography.label, color: colors.textMuted, textTransform: 'uppercase' },
  miniValue: { ...typography.body, color: colors.text, marginTop: 2 },
  section: { marginBottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  dangerZone: { borderColor: colors.danger, borderWidth: 1, marginBottom: spacing.xl },
  confirmText: {
    ...typography.small,
    color: colors.danger,
    fontFamily: fonts.semiBold,
    marginTop: spacing.sm,
  },
  confirmSavedText: {
    ...typography.small,
    color: colors.primary,
    marginTop: spacing.sm,
  },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  routineName: { ...typography.body, color: colors.text, fontFamily: fonts.heading, },
  routineMeta: { ...typography.small, color: colors.textMuted },
  mutedText: { ...typography.small, color: colors.textFaint },
  isoTotalsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.sm },
  isoStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  isoStatValue: { ...typography.h3, color: colors.primaryBright },
  isoStatLabel: { fontSize: 10, color: colors.textMuted, fontFamily: fonts.medium, marginTop: 2 },
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
