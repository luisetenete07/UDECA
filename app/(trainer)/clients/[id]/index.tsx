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
import { alargar, ALARGAR_MESES, coachingDe, DIAS_DE_MARGEN, fechaEscrita } from '../../../../lib/coaching';
import { PeriodoDeCoaching } from '../../../../components/PeriodoDeCoaching';
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
import { notifyUser } from '../../../../lib/notifications';
import {
  exerciseProgression,
  listExercisesInLogs,
  trainingDays,
  trendPerMonth,
  weeklyVolume,
} from '../../../../lib/stats';
import {
  getUserProfile,
  removeClientFromTrainer,
  setClientPlanPauses,
  setClientTrackRir,
  setClientStepGoal,
  setClientVip,
  setCoachingHasta,
  updateClientStatus,
} from '../../../../lib/firestore/users';
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
  // El periodo de coaching (ver lib/coaching.ts): una fecha escrita a mano y
  // el aviso de que se acaba.
  const [fechaInput, setFechaInput] = useState('');
  const [fechaError, setFechaError] = useState<string | null>(null);
  const [avisando, setAvisando] = useState(false);
  const [avisoEnviado, setAvisoEnviado] = useState(false);
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

  /**
   * Fija hasta cuándo entrena con él (o lo quita con null). Se pinta antes de
   * escribir: el toque tiene que verse al momento, y si falla se avisa.
   */
  const fijarPeriodo = async (hasta: number | null) => {
    if (!id || !client) return;
    const antes = client;
    setClient({ ...client, nextPaymentDate: hasta ?? undefined, paymentReportedAt: undefined });
    setAvisoEnviado(false);
    try {
      await setCoachingHasta(id, hasta);
      showToast(hasta ? frase`Coaching hasta el ${fechaCorta(hasta)}` : 'Fecha de fin quitada');
    } catch {
      setClient(antes);
      showToast('No se pudo guardar');
    }
  };

  const handleFechaEscrita = () => {
    const hasta = fechaEscrita(fechaInput);
    if (!hasta) {
      setFechaError('Escribe la fecha así: 13/02/2027');
      return;
    }
    setFechaError(null);
    setFechaInput('');
    fijarPeriodo(hasta);
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

  /** Le avisa de que se le acaba (o se le ha acabado) el periodo. */
  const handleAvisarFin = async () => {
    if (!id || !client) return;
    setAvisando(true);
    try {
      const nombre = client.name.split(' ')[0];
      await notifyUser(
        id,
        'Tu coaching',
        client.nextPaymentDate && client.nextPaymentDate >= Date.now()
          ? frase`Hola ${nombre}, tu periodo de coaching termina el ${fechaCorta(client.nextPaymentDate)}. Háblalo con tu entrenador para renovarlo.`
          : frase`Hola ${nombre}, tu periodo de coaching ha terminado. Háblalo con tu entrenador para renovarlo.`
      );
      setAvisoEnviado(true);
      showToast('Aviso enviado');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo enviar');
    } finally {
      setAvisando(false);
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

  const coaching = coachingDe(client);

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

      {/*
       * EL PERIODO DE COACHING. Es lo único de la relación con el alumno que
       * lleva la app: hasta cuándo entrena contigo. El dinero —cuánto, por
       * dónde, si ya ha pagado— es cosa vuestra, fuera de UDECA. Si pasan
       * unos días sin renovar, al alumno se le pausa la app hasta que lo hagas.
       */}
      <Card style={styles.section}>
        <View style={styles.titleRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.primary} />
          <Text style={styles.sectionTitle}>Coaching</Text>
        </View>

        {client.paymentReportedAt ? (
          <View style={styles.reportedBanner}>
            <Ionicons name="notifications" size={16} color={colors.primaryBright} />
            <Text style={styles.reportedText}>
              {frase`${client.name.split(' ')[0]} te ha pedido renovar (${fechaCorta(client.paymentReportedAt)}).`}
            </Text>
          </View>
        ) : null}

        <PeriodoDeCoaching coaching={coaching} />

        {/* Alargar de un toque: desde el final si aún no ha llegado, desde hoy
            si ya pasó (ver `alargar`). Es lo que se hace casi siempre. */}
        <Text style={styles.alargarRotulo}>Alargar</Text>
        <View style={styles.alargarFila}>
          {ALARGAR_MESES.map((meses) => (
            <Button
              key={meses}
              title={meses === 1 ? '1 mes' : frase`${meses} meses`}
              variant={meses === 1 ? 'primary' : 'secondary'}
              compacto
              onPress={() => fijarPeriodo(alargar(client.nextPaymentDate, meses))}
              style={{ flex: 1 }}
            />
          ))}
        </View>

        {/* Y para lo que no son meses redondos: hasta una fecha concreta. */}
        <View style={styles.payBtnRow}>
          <TextField
            value={fechaInput}
            onChangeText={(v) => {
              setFechaInput(v);
              setFechaError(null);
            }}
            placeholder="Hasta (13/02/2027)"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            containerStyle={{ flex: 1, marginBottom: 0 }}
            style={{ marginBottom: 0 }}
            onSubmitEditing={handleFechaEscrita}
          />
          <Button
            title="Fijar"
            variant="secondary"
            compacto
            onPress={handleFechaEscrita}
            disabled={!fechaInput.trim()}
          />
        </View>
        {fechaError ? <Text style={styles.confirmText}>{fechaError}</Text> : null}

        {coaching.estado === 'acaba' || coaching.estado === 'terminado' || coaching.estado === 'pausado' ? (
          <Button
            title={avisoEnviado ? 'Aviso enviado' : 'Avisarle de que se acaba'}
            variant="secondary"
            onPress={handleAvisarFin}
            loading={avisando}
            disabled={avisoEnviado}
            style={{ marginTop: spacing.sm }}
          />
        ) : null}

        <Text style={styles.payHint}>
          {frase`Si pasan ${DIAS_DE_MARGEN} días sin renovar, se le pausa la app hasta que lo hagas.`}
        </Text>

        {client.nextPaymentDate ? (
          <Pressable onPress={() => fijarPeriodo(null)} style={styles.quitarFecha} hitSlop={8}>
            <Ionicons name="close-circle-outline" size={14} color={colors.textFaint} />
            <Text style={styles.quitarFechaTexto}>Quitar la fecha de fin</Text>
          </Pressable>
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
  // `stretch` para que el campo y el botón midan lo mismo: sus alturas
  // naturales no coinciden y centrados quedaban desalineados.
  alargarFila: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  alargarRotulo: { ...typography.label, color: colors.textMuted, marginBottom: spacing.xs },
  payBtnRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm, marginTop: spacing.sm },
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
  // Relleno apagado y borde de color, no un bloque de color liso: en una
  // pantalla de negros reales un verde saturado se lleva la vista entera, y lo
  // que importa aquí no es el estado del cobro sino el alumno.
  miniLabel: { ...typography.label, color: colors.textMuted, textTransform: 'uppercase' },
  objetivoFila: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  objetivoPlazo: { ...typography.small, color: colors.textFaint, fontSize: 11, width: 78, paddingTop: 2 },
  pasosFila: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.md },
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
