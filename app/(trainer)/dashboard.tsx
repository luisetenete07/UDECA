import { frase } from '../../lib/idioma';
import { diaMes, fechaNumerica, inicioDelDia } from '../../lib/fechas';
import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { DashboardSkeleton } from '../../components/Skeleton';
import { TrialBanner } from '../../components/TrialBanner';
import { UpgradePopup } from '../../components/UpgradeCard';
import { createCoachTask, getCoachTasks, updateCoachTask } from '../../lib/firestore/coachTasks';
import { getCyclesForTrainer } from '../../lib/firestore/cycles';
import { SemanaDelCoach } from '../../components/SemanaDelCoach';
import { CollapsibleCard } from '../../components/CollapsibleCard';
import { PressableScale } from '../../components/PressableScale';
import { FadeIn } from '../../components/FadeIn';
import { ProgressRing } from '../../components/ProgressRing';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import {
  getClientsForTrainer,
  setCoachingHasta,
  subscribeClientsForTrainer,
} from '../../lib/firestore/users';
import { FREE_CLIENT_LIMIT, trainerAtFreeLimit } from '../../lib/subscription';
import { alargar, coachingDe } from '../../lib/coaching';
import { colorDelPeriodo, textoDelPeriodo } from '../../components/PeriodoDeCoaching';
import { approveClientOnServer } from '../../lib/join';
import {
  approveJoinRequest,
  deleteJoinRequest,
  getJoinRequestsForTrainer,
} from '../../lib/firestore/joinRequests';
import { getWorkoutLogsForTrainer } from '../../lib/firestore/workoutLogs';
import { notifyUser } from '../../lib/notifications';
import { getCached, setCached } from '../../lib/screenCache';
import { weekComparison } from '../../lib/stats';
import { Sheet } from '../../components/Sheet';
import { fonts, colors, radius, spacing, typography, tabularNums } from '../../lib/theme';
import {
  type JoinRequest,
  type UserProfile,
  type WorkoutLog,
} from '../../lib/types';


interface DashboardData {
  clients: UserProfile[];
  logs: WorkoutLog[];
  requests: JoinRequest[];
}

export default function TrainerDashboard() {
  // refreshProfile: tras aceptar a un alumno, el servidor actualiza el recuento
  // del perfil y hay que releerlo para que el acceso quede al día.
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  // Pinta al instante lo último conocido (caché de sesión) y refresca detrás.
  const cacheKey = `trainer-dash-${profile?.uid ?? ''}`;
  const cached = getCached<DashboardData>(cacheKey);
  const [clients, setClients] = useState<UserProfile[]>(cached?.clients ?? []);
  const [logs, setLogs] = useState<WorkoutLog[]>(cached?.logs ?? []);
  const [tasks, setTasks] = useState<import('../../lib/types').CoachTask[]>([]);
  const [cycles, setCycles] = useState<import('../../lib/types').TrainingCycle[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>(cached?.requests ?? []);
  const [processingReq, setProcessingReq] = useState<string | null>(null);
  const [loading, setLoading] = useState(cached === undefined);
  // Los periodos de coaching que se acaban o ya se acabaron (ver lib/coaching.ts).
  const [renovarOpen, setRenovarOpen] = useState(false);
  const [renovandoId, setRenovandoId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      let cancelled = false;
      (async () => {
        try {
          const [clientData, logData, requestData, taskData, cycleData] = await Promise.all([
            getClientsForTrainer(profile.uid),
            getWorkoutLogsForTrainer(profile.uid),
            getJoinRequestsForTrainer(profile.uid),
            getCoachTasks(profile.uid).catch(() => []),
            // Para la semana del inicio: los ciclos que empiezan o acaban.
            getCyclesForTrainer(profile.uid).catch(() => []),
          ]);
          if (cancelled) return;
          setClients(clientData);
          setLogs(logData);
          setTasks(taskData);
          setCycles(cycleData);
          setRequests(requestData);
          setCached(cacheKey, {
            clients: clientData,
            logs: logData,
            requests: requestData,
          } satisfies DashboardData);
        } catch (e) {
          if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [profile])
  );

  // Alta/baja de alumnos en vivo: al aceptar a uno nuevo aparece aquí al
  // instante, sin refrescar el panel. Solo mientras el panel está delante.
  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      return subscribeClientsForTrainer(profile.uid, setClients, (e) =>
        showToast(frase`Alumnos en vivo no disponible: ${e.message}`)
      );
    }, [profile])
  );

  // Esqueleto con la cabecera ya pintada: abrir la app no pasa por una
  // pantalla negra con logo, sino por el panel tomando forma.
  if (loading) {
    return (
      <ScreenContainer>
        <ScreenHeader
          eyebrow="Panel del entrenador"
          title={`Hola, ${profile?.name?.split(' ')[0] ?? ''}`}
        />
        {/* Esqueleto con la FORMA del panel, no una lista genérica: al llegar
            los datos nada salta de sitio. */}
        <DashboardSkeleton />
      </ScreenContainer>
    );
  }

  const now = Date.now();

  const wk = weekComparison(logs);
  const hoyCero = inicioDelDia(now);
  const byId = (id: string) => clients.find((c) => c.uid === id);
  // Alumnos distintos que ya han entrenado HOY (va en el pulso del grupo).
  const trainedToday = new Set(
    logs.filter((l) => l.date >= hoyCero).map((l) => l.clientId)
  ).size;

  /*
   * LOS PERIODOS POR RENOVAR. Lo que antes era "cobros": quién se ha quedado
   * sin periodo (o está a punto) y hay que renovar. Sin euros — eso es cosa del
   * entrenador y su alumno, fuera de la app.
   */
  const conPeriodo = clients.map((c) => ({ c, coaching: coachingDe(c, now) }));
  const porRenovar = conPeriodo
    .filter(({ coaching }) => coaching.estado !== 'sin-fecha' && coaching.estado !== 'activo')
    .sort((a, b) => (a.coaching.dias ?? 0) - (b.coaching.dias ?? 0));
  /** Los que ya se pasaron: esos son los que necesitan atención hoy. */
  const terminados = porRenovar.filter(
    ({ coaching }) => coaching.estado === 'terminado' || coaching.estado === 'pausado'
  );

  /** +1 mes desde la lista, sin abrir la ficha: es lo que se hace casi siempre. */
  const handleRenovar = async (c: UserProfile) => {
    setRenovandoId(c.uid);
    const hasta = alargar(c.nextPaymentDate, 1, Date.now());
    try {
      await setCoachingHasta(c.uid, hasta);
      setClients((prev) =>
        prev.map((x) =>
          x.uid === c.uid ? { ...x, nextPaymentDate: hasta, paymentReportedAt: undefined } : x
        )
      );
      showToast(frase`${c.name.split(' ')[0]} · coaching hasta el ${diaMes(hasta)}`);
    } catch {
      showToast('No se pudo renovar');
    } finally {
      setRenovandoId(null);
    }
  };

  /*
   * Las tareas de la semana del inicio: tachar (y destachar) y apuntar una
   * nueva. Se pinta al momento y se guarda detrás: esperar a la red para ver un
   * tic es lo que hace que una app parezca lenta.
   */
  const handleToggleTask = async (t: import('../../lib/types').CoachTask) => {
    const done = !t.done;
    const doneAt = done ? Date.now() : undefined;
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, done, doneAt } : x)));
    try {
      await updateCoachTask(t.id, { done, doneAt: doneAt ?? 0 });
    } catch {
      setTasks((prev) => prev.map((x) => (x.id === t.id ? t : x)));
      showToast('No se pudo marcar');
    }
  };

  const handleAddTask = async (title: string, dueDate: number) => {
    if (!profile) return;
    const temp: import('../../lib/types').CoachTask = {
      id: `tmp-${Date.now()}`,
      trainerId: profile.uid,
      title,
      scope: 'day',
      dueDate,
      done: false,
      order: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setTasks((prev) => [...prev, temp]);
    try {
      const id = await createCoachTask({
        trainerId: profile.uid,
        title,
        scope: 'day',
        dueDate,
        done: false,
        order: temp.order,
      });
      setTasks((prev) => prev.map((x) => (x.id === temp.id ? { ...x, id } : x)));
    } catch {
      setTasks((prev) => prev.filter((x) => x.id !== temp.id));
      showToast('No se pudo guardar');
    }
  };

  const handleApproveRequest = async (req: JoinRequest) => {
    // Aviso inmediato si ya sabemos que está lleno, para no hacerle esperar a
    // una respuesta que va a ser que no.
    if (trainerAtFreeLimit(profile)) {
      showToast(
        frase`Tu plan incluye ${FREE_CLIENT_LIMIT} alumnos. Pasa al plan sin tope para aceptar a más.`
      );
      return;
    }
    setProcessingReq(req.id);
    try {
      // Quien decide es el servidor: cuenta los alumnos con permisos de
      // administrador, así que ni se puede falsear desde un cliente modificado
      // ni dos aprobaciones a la vez pueden colar a un tercero.
      let approved = false;
      try {
        const result = await approveClientOnServer(req.clientId);
        if (!result.ok) {
          showToast(result.reason ?? 'No se pudo aprobar');
          return;
        }
        approved = true;
      } catch {
        // El servidor no responde (sin red, backend caído). Se aprueba por la
        // vía antigua para no dejar al coach bloqueado por una caída ajena; el
        // límite se recalcula igualmente en el siguiente `sync`.
        await approveJoinRequest(req);
        approved = true;
      }
      if (!approved) return;
      await refreshProfile();
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      if (profile) setClients(await getClientsForTrainer(profile.uid));
      notifyUser(req.clientId, 'Solicitud aceptada', 'Tu entrenador te ha aceptado en su grupo. ¡A entrenar!').catch(() => {});
      showToast(frase`${req.name.split(' ')[0]} ya está en tu grupo`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo aprobar');
    } finally {
      setProcessingReq(null);
    }
  };

  const handleRejectRequest = async (req: JoinRequest) => {
    setProcessingReq(req.id);
    try {
      await deleteJoinRequest(req.clientId, req.trainerId);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      showToast('Solicitud rechazada');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo rechazar');
    } finally {
      setProcessingReq(null);
    }
  };

  return (
    <ScreenContainer>
      <TrialBanner profile={profile} />
      {/* A pantalla completa y sin esquivarlo: el tope de alumnos hay que
          saberlo antes de necesitarlo. Se cierra y no vuelve en una semana. */}
      <UpgradePopup />
      <ScreenHeader
        eyebrow="Panel del entrenador"
        title={`Hola, ${profile?.name?.split(' ')[0] ?? ''}`}
        actions={
          <Pressable onPress={() => router.push('/(trainer)/profile')}>
            <Avatar name={profile?.name} photoURL={profile?.photoURL} size={52} />
          </Pressable>
        }
      />

      {/* Lo que necesita acción, arriba del todo y con peso visual.
          Antes esto eran tres pastillas diminutas: lo más urgente del panel
          era también lo más pequeño de la pantalla. Solo aparece si hay algo
          que hacer, para que un día tranquilo no tenga ruido. */}
      {/* Entrada escalonada: los bloques aparecen de arriba abajo, unos
          milisegundos por detrás del anterior. Es lo que hace que la pantalla
          se sienta viva sin que nada se mueva mientras se usa — una animación
          que sigue en marcha cuando ya estás leyendo, molesta. */}
      {requests.length > 0 || terminados.length > 0 ? (
        <FadeIn>
        <Card accent style={styles.section}>
          <View style={styles.titleRow}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>Necesita tu atención</Text>
          </View>
          {/* Abre aquí mismo la lista de quién hay que renovar, con su
              botón de +1 mes: la respuesta se da donde se hace la pregunta. */}
          {terminados.length > 0 ? (
            <Pressable style={styles.attentionRow} onPress={() => setRenovarOpen(true)}>
              <View style={[styles.attentionIcon, { backgroundColor: colors.dangerMuted }]}>
                <Ionicons name="calendar-outline" size={17} color={colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.attentionTitle}>
                  {terminados.length === 1
                    ? frase`1 periodo de coaching terminado`
                    : frase`${terminados.length} periodos de coaching terminados`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            </Pressable>
          ) : null}
          {/* Las solicitudes van AQUÍ, con sus botones. Antes esta fila solo
              decía cuántas había y remataba con "acéptalas más abajo": lo más
              urgente de la pantalla mandaba a buscar el sitio donde resolverlo,
              y la tarjeta de abajo repetía la misma cifra. Aceptar a alguien es
              un toque; no puede costar además un scroll. */}
          {requests.map((req) => (
            <View key={req.id} style={styles.requestRow}>
              <Avatar name={req.name} photoURL={req.photoURL} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.logClient}>{req.name}</Text>
                <Text style={styles.reqEmail} numberOfLines={1}>
                  {req.email}
                </Text>
              </View>
              <View style={styles.reqActions}>
                <Pressable
                  onPress={() => handleRejectRequest(req)}
                  disabled={processingReq === req.id}
                  style={styles.reqReject}
                  hitSlop={6}
                >
                  <Ionicons name="close" size={20} color={colors.danger} />
                </Pressable>
                <Pressable
                  onPress={() => handleApproveRequest(req)}
                  disabled={processingReq === req.id}
                  style={styles.reqApprove}
                  hitSlop={6}
                >
                  <Ionicons name="checkmark" size={20} color={colors.onPrimary} />
                </Pressable>
              </View>
            </View>
          ))}
        </Card>
        </FadeIn>
      ) : null}

      {/* Primeros pasos: guía para el coach recién llegado (sin alumnos todavía). */}
      {clients.length === 0 && requests.length === 0 ? (
        <Card accent style={styles.section}>
          <View style={styles.titleRow}>
            <Ionicons name="rocket-outline" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>Primeros pasos</Text>
          </View>
          <Text style={styles.subtleHint}>Pon en marcha tu coaching en 3 pasos.</Text>
          {[
            {
              n: '1',
              t: 'Invita a tu primer alumno',
              s: 'Comparte tu código desde tu perfil.',
              go: '/(trainer)/profile' as const,
            },
            {
              n: '2',
              t: 'Crea tu primer ejercicio',
              s: 'Tu biblioteca de ejercicios con vídeo.',
              go: '/(trainer)/exercises/new' as const,
            },
            {
              n: '3',
              t: 'Crea un curso',
              s: 'Comparte tu conocimiento en vídeo.',
              go: '/(trainer)/courses/new' as const,
            },
          ].map((step) => (
            <Pressable key={step.n} style={styles.stepRow} onPress={() => router.push(step.go)}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{step.n}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{step.t}</Text>
                <Text style={styles.stepSub}>{step.s}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            </Pressable>
          ))}
        </Card>
      ) : null}

      {loadError ? (
        <Card style={[styles.section, { borderColor: colors.danger }]}>
          <Text style={[styles.sectionTitle, { color: colors.danger }]}>Error al cargar datos</Text>
          <Text style={styles.mutedText}>{loadError}</Text>
        </Card>
      ) : null}

      {/* El pulso del grupo: cuántos alumnos han entrenado ESTA semana. Es el
          número que un entrenador mira primero, y el que dice si hay que
          escribirle a alguien hoy. */}
      {clients.length > 0 ? (
        <FadeIn delay={70}>
        <Card style={styles.section}>
          <View style={styles.pulseRow}>
            <ProgressRing
              progress={wk.activeClients / clients.length}
              value={`${wk.activeClients}/${clients.length}`}
              label="activos"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Tu grupo esta semana</Text>
              <Text style={styles.pulseBig}>
                {wk.activeClients === clients.length
                  ? 'Han entrenado todos'
                  : frase`${clients.length - wk.activeClients} sin entrenar`}
              </Text>
              <Text style={styles.subtleHint}>
                {wk.thisWeek} entreno{wk.thisWeek === 1 ? '' : 's'} en total
                {wk.lastWeek > 0
                  ? wk.thisWeek >= wk.lastWeek
                    ? frase` · ${wk.thisWeek - wk.lastWeek} más que la semana pasada`
                    : frase` · ${wk.lastWeek - wk.thisWeek} menos que la semana pasada`
                  : ''}
              </Text>
              {/* Lo bueno no es una alerta: se cuenta en una línea tranquila,
                  dentro del pulso y no suelto por la pantalla. */}
              {trainedToday > 0 ? (
                <View style={styles.goodNews}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text style={styles.goodNewsText}>
                    {trainedToday === 1
                      ? '1 ha entrenado hoy'
                      : frase`${trainedToday} han entrenado hoy`}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </Card>
        </FadeIn>
      ) : null}

      {/* Los accesos van DESPUÉS de saber cómo va el grupo: son herramientas,
          y una herramienta antes del diagnóstico se usa a ciegas. */}
      <FadeIn delay={140}>
      <View style={styles.quickRow}>
        <Pressable
          style={styles.quickBtn}
          onPress={() => router.push('/(trainer)/exercises/new')}
        >
          <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.quickLabel}>Nuevo ejercicio</Text>
        </Pressable>
        <Pressable style={styles.quickBtn} onPress={() => router.push('/(trainer)/courses/new')}>
          <Ionicons name="videocam-outline" size={20} color={colors.primary} />
          <Text style={styles.quickLabel}>Nuevo curso</Text>
        </Pressable>
        <Pressable style={styles.quickBtn} onPress={() => setRenovarOpen(true)}>
          <View>
            <Ionicons name="refresh-outline" size={20} color={colors.primary} />
            {porRenovar.length > 0 ? (
              <View style={styles.quickBadge}>
                <Text style={styles.quickBadgeText}>{porRenovar.length}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.quickLabel}>Por renovar</Text>
        </Pressable>
      </View>
      </FadeIn>


      {/* La semana: tareas, fines de coaching y ciclos, día a día. Va encima de
          la actividad porque es lo que hay que HACER; la actividad es lo que
          ya pasó. El mes entero, en "Ver mes". */}
      <FadeIn delay={210}>
        <SemanaDelCoach
          clients={clients}
          cycles={cycles}
          tasks={tasks}
          onToggleTask={handleToggleTask}
          onAddTask={handleAddTask}
          onOpen={(ruta) => router.push(ruta as never)}
          onVerMes={() => router.push('/(trainer)/agenda')}
        />
      </FadeIn>

      <FadeIn delay={280}>
      <View style={styles.section}>
      <CollapsibleCard id="actividad" icon="pulse-outline" title="Actividad reciente">
        {logs.length === 0 ? (
          <EmptyState icon="pulse-outline" title="Aún no hay actividad" subtitle="Cuando tus alumnos entrenen, sus sesiones aparecerán aquí." />
        ) : (
          logs.slice(0, 6).map((log) => {
            const client = byId(log.clientId);
            return (
              <Pressable
                key={log.id}
                onPress={() =>
                  router.push(`/(trainer)/clients/${log.clientId}/session?logId=${log.id}`)
                }
                style={styles.activityRow}
              >
                <Avatar name={client?.name} photoURL={client?.photoURL} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.logClient}>{client?.name ?? 'Cliente'}</Text>
                  <Text style={styles.logDetail}>
                    {log.dayName} · {fechaNumerica(log.date)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
              </Pressable>
            );
          })
        )}
      </CollapsibleCard>
      </View>
      </FadeIn>

      {/* Los periodos que se acaban esta semana o ya se acabaron, con +1 mes
          a un toque. Para otra fecha, la ficha del alumno. */}
      <Sheet
        visible={renovarOpen}
        onClose={() => setRenovarOpen(false)}
        titulo={frase`Por renovar (${porRenovar.length})`}
        descripcion="Coaching que se acaba esta semana o ya se acabó."
      >
        {porRenovar.length === 0 ? (
          <Text style={styles.mutedText}>Nadie por renovar. Todo al día.</Text>
        ) : (
          <ScrollView style={{ maxHeight: 460 }}>
            {porRenovar.map(({ c, coaching }) => (
              <View key={c.uid} style={styles.payRow}>
                <Pressable
                  onPress={() => {
                    setRenovarOpen(false);
                    router.push(`/(trainer)/clients/${c.uid}`);
                  }}
                  style={styles.payRowMain}
                >
                  <Avatar name={c.name} photoURL={c.photoURL} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.logClient}>{c.name}</Text>
                    <Text style={[styles.payMeta, { color: colorDelPeriodo(coaching) }]}>
                      {c.paymentReportedAt ? frase`Te ha pedido renovar` : textoDelPeriodo(coaching)}
                    </Text>
                  </View>
                </Pressable>
                <Pressable
                  onPress={() => handleRenovar(c)}
                  disabled={renovandoId === c.uid}
                  style={styles.confirmPayBtn}
                  hitSlop={6}
                >
                  <Ionicons name="add-circle" size={15} color={colors.success} />
                  <Text style={styles.confirmPayText}>
                    {renovandoId === c.uid ? '...' : '1 mes'}
                  </Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}
      </Sheet>

    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pulseBig: { ...typography.h2, color: colors.text, marginTop: 2, marginBottom: 2 },
  quickRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { ...typography.small, color: colors.primary, fontFamily: fonts.heading },
  stepTitle: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  stepSub: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  attentionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attentionTitle: { ...typography.h3, color: colors.text },
  goodNews: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  goodNewsText: { ...typography.small, color: colors.textMuted },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  quickLabel: {
    ...typography.small,
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    textAlign: 'center',
  },
  quickBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  quickBadgeText: { color: colors.white, fontSize: 9, fontFamily: fonts.semiBold },
  section: { marginBottom: spacing.md },
  /* --- Cobros del mes ------------------------------------------------- */
  /*
   * La cifra grande va en BLANCO, no en verde.
   *
   * Estaba en `colors.success`, y el verde de "correcto" aplicado a un importe
   * dice que ese número está bien. No lo está ni lo deja de estar: es lo que se
   * ha cobrado. El color se reserva para lo que sí es un estado —el ámbar de lo
   * pendiente— y así, cuando algo se pone de color, significa algo.
   */
  // Cifras alineadas a la derecha y con cifras de ancho fijo: una columna de
  // importes que baila al cambiar un número se lee como una hoja mal hecha.
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  payMeta: { ...typography.small, color: colors.danger, marginTop: 1 },
  payRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  confirmPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.successBorder,
    backgroundColor: colors.successMuted,
  },
  confirmPayText: { ...typography.small, color: colors.success, fontFamily: fonts.semiBold, fontSize: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  sectionTitle: { ...typography.h3, color: colors.text },
  subtleHint: { ...typography.small, color: colors.textFaint, marginTop: -spacing.xs, marginBottom: spacing.sm },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reqEmail: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  reqActions: { flexDirection: 'row', gap: spacing.sm },
  reqReject: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqApprove: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logClient: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  logDetail: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  mutedText: { ...typography.small, color: colors.textFaint },
});
