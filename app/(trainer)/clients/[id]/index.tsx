import React, { useCallback, useState } from 'react';
import { t, frase  } from '../../../../lib/idioma';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text } from '../../../../components/Texto';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../../../components/Avatar';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Card';
import { EmptyState } from '../../../../components/EmptyState';
import { DashboardSkeleton } from '../../../../components/Skeleton';
import { confirmar } from '../../../../lib/confirmar';
import { hayObjetivos, objetivosDe, objetivosVisibles } from '../../../../lib/objetivos';
import {
  objetivoDeTexto,
  OBJETIVO_MAXIMO,
  OBJETIVO_MINIMO,
  OBJETIVO_POR_DEFECTO,
} from '../../../../lib/pasos';
import { conMiles } from '../../../../lib/texto';
import { getCoursesForTrainer } from '../../../../lib/firestore/courses';
import { getCourseProgress } from '../../../../lib/firestore/courseProgress';
import {
  diasDeAlta,
  estadoDeCurso,
  type LessonsSeen,
} from '../../../../lib/courseProgress';
import { ScreenContainer } from '../../../../components/ScreenContainer';
import { TextField } from '../../../../components/TextField';
import { showToast } from '../../../../components/Toast';
import { ConsistencyMap } from '../../../../components/ConsistencyMap';
import { LineChart } from '../../../../components/LineChart';
import { WeightChart } from '../../../../components/WeightChart';
import { getExerciseLibrary } from '../../../../lib/firestore/exercises';
import {
  billingAnchorOf,
  fechaDeTexto,
  importeDeTexto,
  mensajeDeCobroUnico,
  nextBillingDate,
  validaCobroUnico,
} from '../../../../lib/billing';
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
import {
  exerciseProgression,
  listExercisesInLogs,
  trainingDays,
  trendPerMonth,
  weeklyVolume,
} from '../../../../lib/stats';
import {
  clearClientNextPayment,
  getUserProfile,
  removeClientFromTrainer,
  registerClientPayment,
  setClientPaymentLink,
  setClientPlanPauses,
  setClientTrackRir,
  setClientStepGoal,
  setClientVip,
  updateClientBilling,
  updateClientPaymentStatus,
  updateClientStatus,
} from '../../../../lib/firestore/users';
import { enlaceValido, pistaDelEnlace } from '../../../../lib/enlaceDePago';
import { useAuth } from '../../../../lib/auth-context';
import { CollapsibleCard } from '../../../../components/CollapsibleCard';
import { PausaPlanSheet } from '../../../../components/PausaPlanSheet';
import { pausaActiva, textoRango, type PausaPlan } from '../../../../lib/pausa';
import { Segmented } from '../../../../components/Segmented';
import { diaMes, fechaCorta, fechaNumerica } from '../../../../lib/fechas';
import { fonts, colors, radius, spacing, tabularNums, typography } from '../../../../lib/theme';
import {
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
  type WeightLog,
  type WorkoutLog,
} from '../../../../lib/types';

/** Suma `n` meses a un timestamp (Date gestiona el desbordamiento de mes). */
const DAY_MS = 24 * 60 * 60 * 1000;
export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  // Botón de volver siempre presente: al entrar desde el panel o el ranking la
  // pila de Clientes se abre sin historial y no habría flecha para volver.
  const backToClients = () => (
    <Pressable
      onPress={() => router.replace('/(trainer)/clients')}
      hitSlop={10}
      style={styles.backBtn}
    >
      <Ionicons name="chevron-back" size={24} color={colors.primary} />
      <Text style={styles.backText}>Clientes</Text>
    </Pressable>
  );
  const [client, setClient] = useState<UserProfile | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [muscleByExercise, setMuscleByExercise] = useState<Record<string, string>>({});
  const [measureByExercise, setMeasureByExercise] = useState<Record<string, string>>({});
  const [nutritionPlan, setNutritionPlan] = useState<NutritionPlan | null>(null);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [newHabit, setNewHabit] = useState('');
  const [addingHabit, setAddingHabit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<import('../../../../lib/types').Course[]>([]);
  const [courseSeen, setCourseSeen] = useState<LessonsSeen>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  // Los pasos al día que le pide su entrenador (ver lib/pasos.ts).
  const [pasosInput, setPasosInput] = useState('');
  const [savingPasos, setSavingPasos] = useState(false);
  const [pasosSaved, setPasosSaved] = useState(false);
  const [pasosError, setPasosError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [feeInput, setFeeInput] = useState('');
  // El enlace con el que paga ESTE alumno. Va por alumno y no por entrenador
  // porque cada plan tiene su precio: con uno común el botón cobraría de más
  // a unos y de menos a otros.
  const [linkInput, setLinkInput] = useState('');
  const [savingLink, setSavingLink] = useState(false);
  const [linkSaved, setLinkSaved] = useState(false);
  const [extendDaysInput, setExtendDaysInput] = useState('');
  // Pago único: una fecha de fin y un importe (ver lib/billing.ts).
  const [unicoAbierto, setUnicoAbierto] = useState(false);
  const [unicoFecha, setUnicoFecha] = useState('');
  const [unicoImporte, setUnicoImporte] = useState('');
  const [unicoError, setUnicoError] = useState<string | null>(null);
  const [savingUnico, setSavingUnico] = useState(false);
  const [remindingPayment, setRemindingPayment] = useState(false);
  const [paymentReminderSent, setPaymentReminderSent] = useState(false);
  const [coachNote, setCoachNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [pausaAbierta, setPausaAbierta] = useState(false);
  const [guardandoPausa, setGuardandoPausa] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id || !profile) return;
      let cancelled = false;
      const uid = profile.uid;
      (async () => {
        try {
        const [clientData, routineData, weightData, workoutData, planData, photoData, habitData, habitLogData, noteData, exerciseData] =
          await Promise.all([
            getUserProfile(id),
            getRoutinesForClient(id, uid),
            getWeightLogsForClient(id, uid),
            getWorkoutLogsForClient(id, uid),
            getActiveNutritionPlanForClient(id, uid),
            getProgressPhotosForClient(id, uid),
            getHabitsForClient(id, uid),
            getHabitLogsForClient(id, uid),
            getCoachNote(id),
            getExerciseLibrary(uid),
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
        setPasosInput(clientData?.stepGoal ? String(clientData.stepGoal) : '');
        setFeeInput(clientData?.monthlyFeeEur ? String(clientData.monthlyFeeEur) : '');
        // Si el alumno aún no tiene enlace propio y el entrenador guardaba el
        // común de antes, se ofrece ya escrito: un toque en guardar y queda
        // migrado, sin tener que ir a buscarlo otra vez.
        setLinkInput(clientData?.paymentLink ?? profile?.paymentLink ?? '');
        setRoutines(routineData);
        setWeightLogs(weightData);
        setWorkoutLogs(workoutData);
        setNutritionPlan(planData);
        setPhotos(photoData);
        setHabits(habitData);
        setHabitLogs(habitLogData);
        // Los cursos van detrás y sin bloquear: la ficha se abre para mirar
        // entrenos y cobros, no para saber por qué lección va.
        Promise.all([getCoursesForTrainer(uid), getCourseProgress(id)])
          .then(([cs, seen]) => {
            if (cancelled) return;
            setCourses(cs);
            setCourseSeen(seen);
          })
          .catch(() => {});
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

  /**
   * El entrenador pausa (o reanuda) el plan de su alumno.
   *
   * Es lo que hasta ahora se hacía por WhatsApp —"esta semana descansa, ya
   * retomamos"— y que la app no sabía, así que le seguía pidiendo entrenos y le
   * rompía la racha. Escribe el mismo campo que el alumno desde su perfil: los
   * dos pueden ponerla y los dos pueden quitarla.
   */
  const guardarPausa = async (pausas: PausaPlan[]) => {
    if (!id) return;
    setGuardandoPausa(true);
    try {
      await setClientPlanPauses(id, pausas);
      setClient((c) => (c ? { ...c, planPauses: pausas } : c));
      setPausaAbierta(false);
      showToast(pausaActiva(pausas) ? 'Plan en pausa' : 'Plan reanudado');
    } catch {
      // La ficha se refresca DESPUÉS de escribir, así que si falla no se queda
      // enseñando una pausa que no existe; solo hay que decirlo.
      showToast('No se ha podido guardar la pausa');
    } finally {
      setGuardandoPausa(false);
    }
  };

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
    const h = habits.find((x) => x.id === habitId);
    if (!(await confirmar(frase`¿Quitar "${h?.name ?? t('este hábito')}" de sus hábitos?`))) return;
    setHabits((prev) => prev.filter((x) => x.id !== habitId));
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

  const handleSaveLink = async () => {
    if (!id || !client) return;
    const url = linkInput.trim();
    if (url && !enlaceValido(url)) {
      showToast('El enlace debe empezar por https://');
      return;
    }
    setSavingLink(true);
    try {
      // Con enlace vacío BORRA el campo: si no, el antiguo reaparecería.
      await setClientPaymentLink(id, url);
      setClient({ ...client, paymentLink: url || undefined });
      setLinkSaved(true);
      setTimeout(() => setLinkSaved(false), 2500);
    } catch {
      showToast('No se pudo guardar el enlace');
    } finally {
      setSavingLink(false);
    }
  };

  // Registra el pago: marca "Pagado" y empuja la fecha un mes desde la última
  // renovación (o desde hoy si ya venció). Un solo toque = cobro al día.
  const handleRegisterPayment = async () => {
    if (!id || !client || !profile) return;
    // Ver lib/billing.ts: el mes cobrado arranca en la fecha en que TOCABA
    // pagar, no en la que se paga.
    const anchor =
      client.billingAnchorDay ??
      (client.nextPaymentDate ? billingAnchorOf(client.nextPaymentDate) : undefined);
    const nextPaymentDate = nextBillingDate(client.nextPaymentDate, anchor);
    const billingAnchorDay = anchor ?? billingAnchorOf(nextPaymentDate);
    setClient({
      ...client,
      paymentStatus: 'paid',
      nextPaymentDate,
      billingAnchorDay,
      paymentReportedAt: undefined,
    });
    await registerClientPayment(id, nextPaymentDate, billingAnchorDay);
    // Registro del cobro para el historial de ingresos (con la cuota actual).
    createPayment({
      trainerId: profile.uid,
      clientId: id,
      amountEur: client.monthlyFeeEur ?? 0,
      date: Date.now(),
    }).catch(() => {});
    showToast('Pago registrado · próxima renovación en 1 mes');
  };

  /**
   * Guarda los pasos al día. Vacío = quitar el objetivo y volver al de la app;
   * no es lo mismo que escribir 10.000 a mano, porque el día que cambie el que
   * trae UDECA este alumno se quedaría con el viejo escrito a fuego.
   */
  const handleSaveStepGoal = async () => {
    if (!id) return;
    const limpio = pasosInput.trim();
    const meta = limpio ? objetivoDeTexto(limpio) : undefined;
    if (limpio && meta === undefined) {
      setPasosError(frase`Escribe entre ${conMiles(OBJETIVO_MINIMO)} y ${conMiles(OBJETIVO_MAXIMO)} pasos.`);
      return;
    }
    setPasosError(null);
    setSavingPasos(true);
    try {
      await setClientStepGoal(id, meta);
      setClient((prev) => (prev ? { ...prev, stepGoal: meta } : prev));
      setPasosSaved(true);
      setTimeout(() => setPasosSaved(false), 2500);
    } catch {
      setPasosError('No se pudo guardar.');
    } finally {
      setSavingPasos(false);
    }
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
    showToast(frase`+${days} días · próximo pago ${fechaCorta(nextPaymentDate)}`);
  };

  /**
   * Registra un pago único: deja pagado hasta una fecha y apunta el importe
   * como ingreso, entero y una sola vez.
   *
   * No se toca la cuota mensual a propósito: sigue siendo la que es, y el día
   * que se acabe lo pagado el entrenador decide si renueva igual o de otra
   * forma. Cambiársela aquí sería decidir por él.
   */
  const handleCobroUnico = async () => {
    if (!id || !client || !profile) return;
    const v = validaCobroUnico(fechaDeTexto(unicoFecha), importeDeTexto(unicoImporte));
    if (!v.ok) {
      setUnicoError(mensajeDeCobroUnico(v.error));
      return;
    }
    setUnicoError(null);
    setSavingUnico(true);
    try {
      const billingAnchorDay = billingAnchorOf(v.cobro.hasta);
      setClient({
        ...client,
        paymentStatus: 'paid',
        nextPaymentDate: v.cobro.hasta,
        billingAnchorDay,
        paymentReportedAt: undefined,
      });
      await registerClientPayment(id, v.cobro.hasta, billingAnchorDay);
      await createPayment({
        trainerId: profile.uid,
        clientId: id,
        amountEur: v.cobro.importe,
        date: Date.now(),
      });
      setUnicoFecha('');
      setUnicoImporte('');
      setUnicoAbierto(false);
      showToast(frase`${v.cobro.importe} € · pagado hasta ${fechaCorta(v.cobro.hasta)}`);
    } catch {
      setUnicoError('No se pudo registrar el pago.');
    } finally {
      setSavingUnico(false);
    }
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
        frase`Hola ${client.name.split(' ')[0]}, tienes un pago pendiente de tu suscripción. ¡Gracias!`
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

  // La pantalla donde el entrenador pasa más tiempo no puede recibirle con una
  // rueda girando: el esqueleto tiene la forma de lo que llega, así que nada
  // salta de sitio y se percibe más rápido aunque tarde lo mismo.
  if (loading)
    return (
      <ScreenContainer>
        <Stack.Screen options={{ headerLeft: backToClients }} />
        <DashboardSkeleton />
      </ScreenContainer>
    );
  if (loadError) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ headerLeft: backToClients }} />
        <EmptyState title="No se pudo cargar el cliente" subtitle={loadError} />
      </ScreenContainer>
    );
  }
  if (!client)
    return (
      <>
        <Stack.Screen options={{ headerLeft: backToClients }} />
        <EmptyState title="Cliente no encontrado" />
      </>
    );

  const activeRoutine = routines.find((r) => r.active);
  const currentStatus: ClientStatus = client.status ?? 'active';
  const pausaDelCliente = pausaActiva(client.planPauses);

  const weekly = weeklyVolume(workoutLogs, muscleByExercise);
  const metas = objetivosDe(client);
  const isoTotals = weekly.reduce(
    (acc, w) => ({
      push: acc.push + w.isoPushSeconds,
      pull: acc.pull + w.isoPullSeconds,
      total: acc.total + w.isoSeconds,
    }),
    { push: 0, pull: 0, total: 0 }
  );
  const isoOther = Math.max(0, isoTotals.total - isoTotals.push - isoTotals.pull);

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerLeft: backToClients }} />
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

      {/* Activo / En pausa / Inactivo: tres opciones excluyentes, o sea el
          mismo control que en el resto de la app. */}
      <Segmented
        opciones={CLIENT_STATUSES.map((s) => ({ valor: s, texto: CLIENT_STATUS_LABEL[s] }))}
        valor={currentStatus}
        onChange={handleSetStatus}
      />

      <Card style={styles.section}>
        <View style={styles.titleRow}>
          <Ionicons name="card-outline" size={16} color={colors.primary} />
          <Text style={styles.sectionTitle}>Pagos</Text>
        </View>

        {client.paymentReportedAt ? (
          <View style={styles.reportedBanner}>
            <Ionicons name="notifications" size={16} color={colors.primaryBright} />
            <Text style={styles.reportedText}>
              {client.name.split(' ')[0]} declaró que ya ha pagado ({fechaCorta(client.paymentReportedAt)}).
              Confírmalo con "Registrar pago".
            </Text>
          </View>
        ) : null}

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
                <Text
                  style={[
                    styles.payChipText,
                    active && styles.payChipTextActive,
                    active && tone === 'good' && { color: colors.success },
                    active && tone === 'warn' && { color: colors.warning },
                    active && tone === 'bad' && { color: colors.danger },
                  ]}
                >
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

        {/* El enlace de pago, justo debajo de la cuota: son la misma decisión.
            Lo que se cobra y por dónde se cobra van juntos, y así se ve de un
            vistazo si el importe del enlace y la cuota cuadran. */}
        <Text style={styles.paymentLabel}>Enlace de pago de {client.name.split(' ')[0]}</Text>
        <TextField
          value={linkInput}
          onChangeText={setLinkInput}
          placeholder="https://buy.stripe.com/…"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={{ marginBottom: spacing.xs }}
        />
        <Text style={styles.payHint}>{pistaDelEnlace(linkInput, client.monthlyFeeEur)}</Text>
        {linkSaved ? <Text style={styles.guardado}>Enlace guardado</Text> : null}
        <Button
          title="Guardar enlace"
          variant="secondary"
          onPress={handleSaveLink}
          loading={savingLink}
          disabled={linkInput.trim() === (client.paymentLink ?? '')}
          style={{ marginTop: spacing.xs, marginBottom: spacing.md }}
        />

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
              ? `${fechaCorta(client.nextPaymentDate)}${
                  client.nextPaymentDate < Date.now() ? ' · vencido' : ''
                }`
              : 'Sin fecha establecida'}
          </Text>
        </View>

        <Button
          title="Registrar pago"
          onPress={handleRegisterPayment}
          style={{ marginTop: spacing.sm }}
        />
        {/* Lo que hace el botón, debajo del botón: metido entre paréntesis en
            el propio rótulo partía el texto en dos líneas y se leía peor. */}
        <Text style={styles.payHint}>Suma un mes a la fecha de arriba.</Text>
        {/* Dos piezas en la fila y no tres. Quitar la fecha estaba metido aquí
            como un botón cuadrado, y además de dejar la fila a tres alturas
            distintas ponía una acción destructiva a un dedo de una que se usa
            a diario. Ahora va abajo, como enlace, igual que el resto de lo
            destructivo en la app. */}
        <View style={styles.payBtnRow}>
          <TextField
            value={extendDaysInput}
            onChangeText={setExtendDaysInput}
            keyboardType="number-pad"
            placeholder="Días"
            containerStyle={styles.daysField}
          />
          {/* Compacto: al lado del campo de días, la caja se queda en 134
              píxeles en un móvil estrecho, y con el aire de un botón normal
              —24 a cada lado— la etiqueta se quedaba en "Añadir dí…". */}
          <Button
            title="Añadir días"
            variant="secondary"
            compacto
            onPress={handleExtendDays}
            disabled={!(parseInt(extendDaysInput, 10) > 0)}
            style={{ flex: 1 }}
          />
        </View>

        {/* Pago único: 180 € por seis meses el primer día, por ejemplo. Antes
            se apañaba con "añadir días" y luego había que acordarse de que ese
            importe no era la cuota, así que el ingreso más grande del año era
            justo el peor apuntado. */}
        <Pressable onPress={() => setUnicoAbierto((v) => !v)} style={styles.unicoCabecera} hitSlop={6}>
          <Ionicons
            name={unicoAbierto ? 'chevron-down' : 'chevron-forward'}
            size={15}
            color={colors.primary}
          />
          <Text style={styles.unicoTitulo}>Pago único hasta una fecha</Text>
        </Pressable>
        {unicoAbierto ? (
          <View style={styles.unicoCaja}>
            <Text style={styles.payHint}>
              Paga de una vez y queda cubierto hasta el día que pongas. El importe entra en tus
              ingresos tal cual, sin partirlo en cuotas.
            </Text>
            <View style={styles.payBtnRow}>
              <TextField
                value={unicoFecha}
                onChangeText={setUnicoFecha}
                placeholder="Hasta (13/02/2027)"
                autoCapitalize="none"
                autoCorrect={false}
                containerStyle={{ flex: 1, marginBottom: 0 }}
                style={{ marginBottom: 0 }}
              />
              <TextField
                value={unicoImporte}
                onChangeText={setUnicoImporte}
                placeholder="180 €"
                keyboardType="decimal-pad"
                containerStyle={styles.daysField}
                style={{ marginBottom: 0 }}
              />
            </View>
            {unicoError ? <Text style={styles.confirmText}>{unicoError}</Text> : null}
            <Button
              title="Registrar pago único"
              variant="secondary"
              onPress={handleCobroUnico}
              loading={savingUnico}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        ) : null}
        {client.nextPaymentDate ? (
          <Pressable onPress={handleClearNextPayment} style={styles.quitarFecha} hitSlop={8}>
            <Ionicons name="close-circle-outline" size={14} color={colors.textFaint} />
            <Text style={styles.quitarFechaTexto}>Quitar la fecha de próximo pago</Text>
          </Pressable>
        ) : null}

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

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Rutina asignada</Text>
        {activeRoutine ? (
          <>
            <Text style={styles.routineName}>{activeRoutine.name}</Text>
            <Text style={styles.routineMeta}>
              {activeRoutine.days.length}{' '}
              {activeRoutine.days.length === 1 ? 'día' : 'días'} de entrenamiento
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

        {/* La planificación por ciclos, aquí dentro. Era una tarjeta suya con
            un título, un párrafo y una flecha: el sitio de la temporada es
            junto a la rutina que se entrena en ella, no en un cajón aparte. */}
        <Pressable
          style={styles.pausaFila}
          onPress={() => router.push(`/(trainer)/clients/${id}/planning`)}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.navTitle}>Planificación por ciclos</Text>
            <Text style={styles.navHint}>
              La temporada en bloques y semanas, su cumplimiento y el progreso ejercicio a
              ejercicio.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
        </Pressable>

        {/* Cambio de urgencia: unos días sin entrenar sin tocar la rutina.
            Va dentro de esta tarjeta porque es lo que se hace cuando la rutina
            asignada no encaja con la semana que tiene el alumno delante. */}
        <Pressable style={styles.pausaFila} onPress={() => setPausaAbierta(true)}>
          <Ionicons name="pause-circle-outline" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.navTitle}>
              {pausaDelCliente ? 'Plan en pausa' : 'Pausar el plan unos días'}
            </Text>
            <Text style={styles.navHint}>
              {pausaDelCliente
                ? `${textoRango(pausaDelCliente)}${
                    pausaDelCliente.motivo ? ` · ${pausaDelCliente.motivo}` : ''
                  }${pausaDelCliente.porQuien === 'alumno' ? ' · la puso el alumno' : ''}`
                : 'Lesión, viaje o una semana imposible: no se le pide nada, no pierde la racha y el plan le espera donde lo dejó.'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
        </Pressable>
      </Card>

      <PausaPlanSheet
        visible={pausaAbierta}
        onClose={() => setPausaAbierta(false)}
        pausas={client?.planPauses}
        activa={pausaDelCliente}
        porQuien="coach"
        guardando={guardandoPausa}
        onGuardar={guardarPausa}
      />

      {hayObjetivos(metas) || client.targetWeightKg ? (
        <Card style={styles.section}>
          {hayObjetivos(metas) ? (
            <>
              <Text style={styles.miniLabel}>Sus objetivos</Text>
              {objetivosVisibles(metas).map((o) => (
                <View key={o.etiqueta} style={styles.objetivoFila}>
                  <Text style={styles.objetivoPlazo}>{o.etiqueta}</Text>
                  <Text style={styles.objetivoTexto}>{o.texto}</Text>
                </View>
              ))}
            </>
          ) : null}
          {client.targetWeightKg ? (
            <Text style={[styles.miniValue, { marginTop: hayObjetivos(metas) ? spacing.md : 0 }]}>
              Peso objetivo: {client.targetWeightKg} kg
            </Text>
          ) : null}
        </Card>
      ) : null}

      {/* Por dónde va en cada curso. Solo los publicados: los borradores no ha
          podido verlos y saldrían siempre a cero, como si el alumno fallara. */}
      {(() => {
        const publicados = courses.filter((c) => c.published);
        if (publicados.length === 0) return null;
        const dias = diasDeAlta(client.createdAt);
        const estados = publicados
          .map((c) => estadoDeCurso(c, courseSeen[c.id], dias))
          .filter((e) => e.total > 0);
        if (estados.length === 0) return null;
        return (
          <Card style={styles.section}>
            <View style={styles.titleRow}>
              <Ionicons name="school-outline" size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>Cursos</Text>
            </View>
            {estados.map((e) => (
              <View key={e.courseId} style={styles.cursoFila}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cursoNombre} numberOfLines={1}>
                    {e.titulo}
                  </Text>
                  <View style={styles.cursoBarra}>
                    <View
                      style={[styles.cursoBarraFill, { width: `${e.ratio * 100}%` }]}
                    />
                  </View>
                </View>
                <Text style={styles.cursoPct}>
                  {e.terminado ? 'Hecho' : `${e.hechas}/${e.total}`}
                </Text>
              </View>
            ))}
          </Card>
        );
      })()}

      <CollapsibleCard
        id="alumno-notas"
        icon="lock-closed-outline"
        title="Notas privadas"
        hint={coachNote.trim() ? coachNote.trim().slice(0, 40) : 'Sin notas'}
        defaultOpen={false}
      >
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
      </CollapsibleCard>

      {/* VIP: qué plan tiene contratado, en la práctica. Va aquí arriba —con
          los pagos y la rutina— y no escondido entre los ajustes, porque es
          una decisión de negocio: es lo que separa al que paga el plan de
          arriba del que paga el normal. */}
      <CollapsibleCard
        id="alumno-vip"
        icon="lock-closed-outline"
        title="Alumno VIP"
        hint={client?.vip === true ? 'Sí' : 'No'}
        defaultOpen={false}
      >
        <View style={styles.rirRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.mutedText}>
              Los alumnos VIP ven además las clases que hayas marcado como VIP dentro de tus
              cursos. Para el resto, esas clases no existen: no se les enseña un candado ni un
              anuncio de lo que no tienen.
            </Text>
          </View>
          <Switch
            value={client?.vip === true}
            onValueChange={async (v) => {
              if (!id || !client) return;
              setClient({ ...client, vip: v });
              try {
                await setClientVip(id, v);
              } catch {
                setClient({ ...client, vip: !v });
                showToast('No se pudo guardar');
              }
            }}
            trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
            thumbColor={colors.white}
          />
        </View>
      </CollapsibleCard>

      {/* Los pasos al día que le pide. Va junto a lo demás que decide el
          entrenador sobre este alumno, no en un ajuste general: no es lo mismo
          un repartidor que alguien que pasa ocho horas sentado. */}
      <CollapsibleCard
        id="alumno-pasos"
        icon="walk-outline"
        title="Pasos al día"
        hint={client?.stepGoal ? conMiles(client.stepGoal) : frase`${conMiles(OBJETIVO_POR_DEFECTO)} (por defecto)`}
        defaultOpen={false}
      >
        <Text style={styles.mutedText}>
          Los que le pides cada día. Los ve en su pestaña de nutrición, y lo que ande le suma
          calorías al plan del día. Si lo dejas vacío, se le piden{' '}
          {conMiles(OBJETIVO_POR_DEFECTO)}.
        </Text>
        <View style={styles.pasosFila}>
          <TextField
            value={pasosInput}
            onChangeText={setPasosInput}
            placeholder={String(OBJETIVO_POR_DEFECTO)}
            keyboardType="number-pad"
            containerStyle={{ flex: 1, marginBottom: 0 }}
            style={{ marginBottom: 0 }}
          />
          <Button
            title="Guardar"
            variant="secondary"
            onPress={handleSaveStepGoal}
            loading={savingPasos}
            style={{ minWidth: 110 }}
          />
        </View>
        {pasosError ? <Text style={styles.confirmText}>{pasosError}</Text> : null}
        {pasosSaved ? <Text style={styles.confirmSavedText}>Objetivo guardado</Text> : null}
      </CollapsibleCard>

      <CollapsibleCard
        id="alumno-rir"
        icon="speedometer-outline"
        title="Pedirle el esfuerzo (RIR)"
        hint={client?.trackRir === true ? 'Sí' : 'No'}
        defaultOpen={false}
      >
        <View style={styles.rirRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.mutedText}>
              Al terminar cada ejercicio le preguntamos cuántas repeticiones le quedaban. Actívalo
              solo si entiende lo que es: quien empieza lo rellena al azar, y un dato inventado es
              peor que no tenerlo.
            </Text>
          </View>
          <Switch
            value={client?.trackRir === true}
            onValueChange={async (v) => {
              if (!id || !client) return;
              setClient({ ...client, trackRir: v });
              try {
                await setClientTrackRir(id, v);
              } catch {
                setClient({ ...client, trackRir: !v });
                showToast('No se pudo guardar');
              }
            }}
            trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
            thumbColor={colors.white}
          />
        </View>
      </CollapsibleCard>


      <CollapsibleCard
        id="alumno-nutricion"
        icon="nutrition-outline"
        title="Plan nutricional"
        hint={
          nutritionPlan
            ? `${nutritionPlan.dailyCalories} kcal`
            : client.nutritionTargets
              ? `${client.nutritionTargets.dailyCalories} kcal`
              : 'Sin plan'
        }
        defaultOpen={false}
      >
        {nutritionPlan ? (
          <>
            <Text style={styles.routineName}>{nutritionPlan.name}</Text>
            <Text style={styles.routineMeta}>
              {nutritionPlan.dailyCalories} kcal · P{nutritionPlan.proteinG}g C
              {nutritionPlan.carbsG}g G{nutritionPlan.fatG}g
            </Text>
          </>
        ) : client.nutritionTargets ? (
          <>
            <Text style={styles.routineName}>Plan del alumno (onboarding)</Text>
            <Text style={styles.routineMeta}>
              {client.nutritionTargets.dailyCalories} kcal · P{client.nutritionTargets.proteinG}g C
              {client.nutritionTargets.carbsG}g G{client.nutritionTargets.fatG}g
            </Text>
            <Text style={[styles.mutedText, { marginTop: spacing.xs }]}>
              Plan oficial calculado por el alumno en el onboarding. Puedes ajustarlo si lo ves
              necesario.
            </Text>
          </>
        ) : (
          <Text style={styles.mutedText}>Este cliente no tiene un plan nutricional activo.</Text>
        )}
        <Button
          title={nutritionPlan ? 'Editar plan' : client.nutritionTargets ? 'Ver plan' : 'Crear plan'}
          variant="secondary"
          onPress={() => router.push(`/(trainer)/clients/${id}/nutrition`)}
          style={{ marginTop: spacing.md }}
        />
      </CollapsibleCard>

      <CollapsibleCard
        id="alumno-peso"
        icon="trending-down-outline"
        title="Evolución del peso"
        hint={weightLogs.length > 0 ? `${weightLogs[0].weightKg} kg` : 'Sin registros'}
        defaultOpen={false}
      >
        <WeightChart logs={weightLogs} />
      </CollapsibleCard>

      <CollapsibleCard
        id="alumno-fotos"
        icon="camera-outline"
        title="Fotos de progreso"
        hint={photos.length > 0 ? `${photos.length}` : 'Ninguna'}
        defaultOpen={false}
      >
        {photos.length === 0 ? (
          <Text style={styles.mutedText}>El cliente todavía no ha subido fotos.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
            {photos.slice(0, 12).map((p) => (
              <View key={p.id} style={styles.photoItem}>
                <Image source={{ uri: p.imageURL }} style={styles.photo} resizeMode="cover" />
                <Text style={styles.photoDate}>
                  {diaMes(p.date)}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
      </CollapsibleCard>

      <CollapsibleCard
        id="alumno-habitos"
        icon="checkmark-done-outline"
        title="Hábitos diarios"
        hint={habits.length > 0 ? `${habits.length}` : 'Ninguno'}
        defaultOpen={false}
      >
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
      </CollapsibleCard>

      <CollapsibleCard
        id="alumno-actividad"
        icon="pulse-outline"
        title="Actividad (12 semanas)"
        hint={`${workoutLogs.length}`}
        defaultOpen={false}
      >
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

        {(() => {
          // Ritmo de progreso proyectado de sus ejercicios más recientes.
          const trends = listExercisesInLogs(workoutLogs)
            .slice(0, 4)
            .map((e) => exerciseProgression(workoutLogs, e.exerciseId))
            .filter((prog): prog is NonNullable<typeof prog> => prog !== null)
            .map((prog) => ({
              name: prog.name,
              unit: prog.measure === 'seconds' ? 's' : prog.hasWeight ? 'kg' : 'reps',
              slope: trendPerMonth(
                prog.points.map((p) => ({
                  date: p.date,
                  value: prog.hasWeight ? p.weight : p.reps,
                }))
              ),
            }))
            .filter((t) => t.slope !== null);
          if (trends.length === 0) return null;
          return (
            <>
              <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>
                Ritmo de progreso
              </Text>
              <Text style={styles.mutedText}>Tendencia al mes según sus últimas sesiones.</Text>
              {trends.map((t) => {
                const v = t.slope as number;
                const flat = Math.abs(v) < 0.3;
                const color = flat ? colors.textMuted : v > 0 ? colors.success : colors.danger;
                const label = flat
                  ? 'estable'
                  : `${v > 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')} ${t.unit}/mes`;
                return (
                  <View key={t.name} style={styles.trendRow}>
                    <Text style={styles.trendName} numberOfLines={1}>
                      {t.name}
                    </Text>
                    <Ionicons
                      name={flat ? 'remove' : v > 0 ? 'trending-up' : 'trending-down'}
                      size={14}
                      color={color}
                    />
                    <Text style={[styles.trendValue, { color }]}>{label}</Text>
                  </View>
                );
              })}
            </>
          );
        })()}
      </CollapsibleCard>

      <CollapsibleCard
        id="alumno-historial"
        icon="time-outline"
        title="Historial de entrenamientos"
        hint={workoutLogs.length > 0 ? `${workoutLogs.length}` : 'Vacío'}
        defaultOpen={false}
      >
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
                    {fechaNumerica(log.date)}
                  </Text>
                </View>
                <Text style={styles.logExercises}>{log.exercises.length} ejercicios</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
              </View>
            </Pressable>
          ))
        )}
      </CollapsibleCard>

      <CollapsibleCard
        id="alumno-gestion"
        icon="person-remove-outline"
        title="Gestión del alumno"
        defaultOpen={false}
        style={styles.ultimaTarjeta}
      >
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
      </CollapsibleCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  // La última tarjeta se pegaba al borde de abajo: el botón de sacar del grupo
  // quedaba a ras del final de la pantalla, sin aire para pulsarlo tranquilo.
  ultimaTarjeta: { marginBottom: spacing.xl },
  pausaFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  navTitle: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  navHint: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  rirRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: spacing.sm },
  backText: { ...typography.body, color: colors.primary, fontFamily: fonts.medium },
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
  reportedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.primaryMuted,
  },
  reportedText: { ...typography.small, color: colors.primaryBright, flex: 1, lineHeight: 18 },
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
  cursoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  cursoNombre: { ...typography.small, color: colors.text, fontFamily: fonts.medium },
  cursoBarra: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    marginTop: 6,
  },
  cursoBarraFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },
  cursoPct: {
    ...typography.small,
    color: colors.textMuted,
    fontFamily: fonts.semiBold,
    ...tabularNums,
  },
  payHint: { ...typography.small, color: colors.textFaint, marginTop: spacing.xs, textAlign: 'center' },
  guardado: {
    ...typography.small,
    color: colors.primaryBright,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  // `stretch` para que el campo y el botón midan lo mismo: sus alturas
  // naturales no coinciden y centrados quedaban desalineados.
  payBtnRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm, marginTop: spacing.sm },
  daysField: { width: 84, marginBottom: 0 },
  /*
   * 52 de alto, como el campo y el botón que tiene al lado.
   *
   * Estaba en 44 y con `alignItems: 'center'` flotaba en medio de la fila,
   * ocho píxeles más bajo que sus dos vecinos. Es de esas cosas que no se
   * saben nombrar pero se ven: la fila parecía mal montada.
   */
  quitarFecha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  quitarFechaTexto: { ...typography.small, color: colors.textFaint },
  payChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  payChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  // Relleno apagado y borde de color, no un bloque de color liso: en una
  // pantalla de negros reales un verde saturado se lleva la vista entera, y lo
  // que importa aquí no es el estado del cobro sino el alumno.
  payGood: { backgroundColor: colors.successMuted, borderColor: colors.successBorder },
  payWarn: { backgroundColor: colors.warningMuted, borderColor: colors.warning },
  payBad: { backgroundColor: colors.dangerMuted, borderColor: colors.danger },
  payChipText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold, fontSize: 12 },
  payChipTextActive: { color: colors.white },
  miniLabel: { ...typography.label, color: colors.textMuted, textTransform: 'uppercase' },
  objetivoFila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  objetivoPlazo: { ...typography.small, color: colors.textFaint, fontSize: 11, width: 78, paddingTop: 2 },
  pasosFila: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.md },
  unicoCabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  unicoTitulo: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  unicoCaja: { marginTop: spacing.xs },
  objetivoTexto: { ...typography.small, color: colors.text, flex: 1, lineHeight: 18 },
  miniValue: { ...typography.body, color: colors.text, marginTop: 2 },
  section: { marginBottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
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
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  trendName: { ...typography.small, color: colors.text, flex: 1, fontFamily: fonts.medium },
  trendValue: { ...typography.small, fontFamily: fonts.semiBold, fontSize: 12 },
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
