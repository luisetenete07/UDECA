import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { CopilotMark } from '../../components/CopilotMark';
import { EmptyState } from '../../components/EmptyState';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ScreenContainer } from '../../components/ScreenContainer';
import { StatTile } from '../../components/StatTile';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import { getClientsForTrainer, updateClientPaymentStatus } from '../../lib/firestore/users';
import { getPaymentsForTrainer } from '../../lib/firestore/payments';
import {
  approveJoinRequest,
  deleteJoinRequest,
  getJoinRequestsForTrainer,
} from '../../lib/firestore/joinRequests';
import { getWorkoutLogsForTrainer } from '../../lib/firestore/workoutLogs';
import { getExercisesForTrainer } from '../../lib/firestore/exercises';
import { getCheckInsForTrainer } from '../../lib/firestore/checkins';
import { buildCopilotReport, type CopilotReport } from '../../lib/copilot';
import { notifyUser } from '../../lib/notifications';
import { getCached, setCached } from '../../lib/screenCache';
import { weekComparison } from '../../lib/stats';
import { fonts, colors, radius, spacing, typography } from '../../lib/theme';
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  type JoinRequest,
  type UserProfile,
  type WorkoutLog,
} from '../../lib/types';

const INACTIVE_DAYS_THRESHOLD = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const PAY_TONE_COLOR: Record<'good' | 'warn' | 'bad' | 'muted', string> = {
  good: '#2E7D5B',
  warn: '#C9902B',
  bad: colors.danger,
  muted: colors.textFaint,
};

interface DashboardData {
  clients: UserProfile[];
  logs: WorkoutLog[];
  requests: JoinRequest[];
  payments: import('../../lib/types').Payment[];
}

export default function TrainerDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  // Pinta al instante lo último conocido (caché de sesión) y refresca detrás.
  const cacheKey = `trainer-dash-${profile?.uid ?? ''}`;
  const cached = getCached<DashboardData>(cacheKey);
  const [clients, setClients] = useState<UserProfile[]>(cached?.clients ?? []);
  const [logs, setLogs] = useState<WorkoutLog[]>(cached?.logs ?? []);
  const [requests, setRequests] = useState<JoinRequest[]>(cached?.requests ?? []);
  const [payments, setPayments] = useState<import('../../lib/types').Payment[]>(
    cached?.payments ?? []
  );
  const [processingReq, setProcessingReq] = useState<string | null>(null);
  const [loading, setLoading] = useState(cached === undefined);
  const [remindingPays, setRemindingPays] = useState(false);
  const [paysReminded, setPaysReminded] = useState(false);
  const [payListOpen, setPayListOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotReport, setCopilotReport] = useState<CopilotReport | null>(null);
  const [loadingCopilot, setLoadingCopilot] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      let cancelled = false;
      (async () => {
        try {
          const [clientData, logData, requestData, paymentData] = await Promise.all([
            getClientsForTrainer(profile.uid),
            getWorkoutLogsForTrainer(profile.uid),
            getJoinRequestsForTrainer(profile.uid),
            getPaymentsForTrainer(profile.uid),
          ]);
          if (cancelled) return;
          setClients(clientData);
          setLogs(logData);
          setRequests(requestData);
          setPayments(paymentData);
          setCached(cacheKey, {
            clients: clientData,
            logs: logData,
            requests: requestData,
            payments: paymentData,
          } satisfies DashboardData);
          // Marca automáticamente como "Vencido" a quien se le pasó la fecha
          // de pago y no estaba ya marcado (aviso automático de impago).
          const nowTs = Date.now();
          const toOverdue = clientData.filter(
            (c) => c.nextPaymentDate && c.nextPaymentDate < nowTs && c.paymentStatus !== 'overdue'
          );
          if (toOverdue.length > 0) {
            toOverdue.forEach((c) => updateClientPaymentStatus(c.uid, 'overdue').catch(() => {}));
            const ids = new Set(toOverdue.map((c) => c.uid));
            setClients((prev) =>
              prev.map((c) => (ids.has(c.uid) ? { ...c, paymentStatus: 'overdue' } : c))
            );
          }
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

  if (loading) return <LoadingScreen />;

  const now = Date.now();
  const lastLogByClient = new Map<string, number>();
  logs.forEach((log) => {
    const current = lastLogByClient.get(log.clientId);
    if (!current || log.date > current) lastLogByClient.set(log.clientId, log.date);
  });

  const inactiveClients = clients.filter((client) => {
    const last = lastLogByClient.get(client.uid);
    if (!last) return true;
    return (now - last) / (1000 * 60 * 60 * 24) > INACTIVE_DAYS_THRESHOLD;
  });

  const wk = weekComparison(logs);
  const byId = (id: string) => clients.find((c) => c.uid === id);
  // Alumnos distintos que ya han entrenado HOY (para el panel "Hoy").
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const trainedToday = new Set(
    logs.filter((l) => l.date >= todayStart.getTime()).map((l) => l.clientId)
  ).size;
  // Alumnos con pago pendiente o vencido (para el atajo "Recordar pagos").
  const duePayClients = clients.filter(
    (c) => c.paymentStatus === 'pending' || c.paymentStatus === 'overdue'
  );

  // ----- Resumen de cobros -----
  const feeOf = (c: UserProfile) => c.monthlyFeeEur ?? 0;
  const pendingAmount = clients
    .filter((c) => c.paymentStatus === 'pending' || c.paymentStatus === 'overdue')
    .reduce((s, c) => s + feeOf(c), 0);
  const payCounts = clients.reduce(
    (acc, c) => {
      if (c.paymentStatus) acc[c.paymentStatus] = (acc[c.paymentStatus] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const overdueCount = clients.filter(
    (c) => c.nextPaymentDate && c.nextPaymentDate < now
  ).length;
  const dueSoonCount = clients.filter(
    (c) => c.nextPaymentDate && c.nextPaymentDate >= now && c.nextPaymentDate < now + 7 * DAY_MS
  ).length;
  const showBilling = clients.some(
    (c) => c.paymentStatus || c.monthlyFeeEur || c.nextPaymentDate
  ) || payments.length > 0;
  // Ingresos realmente cobrados este mes (a partir de los pagos registrados).
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const incomeThisMonth = payments
    .filter((p) => p.date >= monthStart.getTime())
    .reduce((s, p) => s + (p.amountEur || 0), 0);
  // Proyección: renovaciones con fecha en los próximos 30 días (cuota fijada).
  const upcoming = clients.filter(
    (c) =>
      c.nextPaymentDate &&
      c.nextPaymentDate >= now &&
      c.nextPaymentDate < now + 30 * DAY_MS &&
      (c.monthlyFeeEur ?? 0) > 0
  );
  const projected30 = upcoming.reduce((s, c) => s + (c.monthlyFeeEur ?? 0), 0);
  // El próximo cobro que se avecina (aún no vencido): el alumno con la fecha
  // de renovación más cercana. Se muestra con nombre para saber de quién es.
  const nextPayment = clients
    .filter((c) => c.nextPaymentDate && c.nextPaymentDate >= now)
    .sort((a, b) => (a.nextPaymentDate ?? 0) - (b.nextPaymentDate ?? 0))[0] ?? null;


  const handleApproveRequest = async (req: JoinRequest) => {
    setProcessingReq(req.id);
    try {
      await approveJoinRequest(req);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      if (profile) setClients(await getClientsForTrainer(profile.uid));
      notifyUser(req.clientId, 'Solicitud aceptada', 'Tu entrenador te ha aceptado en su grupo. ¡A entrenar!').catch(() => {});
      showToast(`${req.name.split(' ')[0]} ya está en tu grupo`);
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

  // Copiloto UDECA: análisis semanal del grupo bajo demanda (carga los
  // check-ins solo al abrirlo para no frenar el panel).
  const handleOpenCopilot = async () => {
    if (copilotOpen) {
      setCopilotOpen(false);
      return;
    }
    if (!profile) return;
    setCopilotOpen(true);
    setLoadingCopilot(true);
    try {
      const [checkIns, library] = await Promise.all([
        getCheckInsForTrainer(profile.uid),
        getExercisesForTrainer(profile.uid),
      ]);
      const muscleMap = Object.fromEntries(library.map((e) => [e.id, e.muscleGroup]));
      setCopilotReport(buildCopilotReport(clients, logs, checkIns, muscleMap));
    } catch {
      setCopilotReport(buildCopilotReport(clients, logs, []));
    } finally {
      setLoadingCopilot(false);
    }
  };

  // Un toque: recordatorio de pago a TODOS los alumnos con pago pendiente.
  const handleRemindAllPayments = async () => {
    if (duePayClients.length === 0) {
      showToast('No hay pagos pendientes');
      return;
    }
    setRemindingPays(true);
    try {
      await Promise.all(
        duePayClients.map((c) =>
          notifyUser(
            c.uid,
            'Recordatorio de pago',
            `Hola ${c.name.split(' ')[0]}, tienes un pago pendiente de tu suscripción. ¡Gracias!`
          )
        )
      );
      setPaysReminded(true);
      showToast(`Recordatorio enviado a ${duePayClients.length} alumno(s)`);
    } finally {
      setRemindingPays(false);
    }
  };


  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greetingLabel}>Panel del entrenador</Text>
          <Text style={styles.greeting}>Hola, {profile?.name?.split(' ')[0]}</Text>
        </View>
        <Pressable onPress={() => router.push('/(trainer)/profile')}>
          <Avatar name={profile?.name} photoURL={profile?.photoURL} size={52} />
        </Pressable>
      </View>

      {/* Panel "Hoy": qué requiere acción, en 10 segundos. Solo aparece si
          hay algo que hacer (cero ruido cuando todo está al día). */}
      {requests.length > 0 || overdueCount > 0 || inactiveClients.length > 0 || trainedToday > 0 ? (
        <View style={styles.todayStrip}>
          {trainedToday > 0 ? (
            <View style={[styles.todayChip, styles.todayChipGood]}>
              <Ionicons name="checkmark-circle" size={13} color="#2E7D5B" />
              <Text style={[styles.todayChipText, { color: '#2E7D5B' }]}>
                {trainedToday} entrenó hoy
              </Text>
            </View>
          ) : null}
          {requests.length > 0 ? (
            <View style={[styles.todayChip, styles.todayChipWarn]}>
              <Ionicons name="person-add" size={13} color={colors.primary} />
              <Text style={[styles.todayChipText, { color: colors.primaryBright }]}>
                {requests.length} solicitud(es)
              </Text>
            </View>
          ) : null}
          {overdueCount > 0 ? (
            <Pressable
              style={[styles.todayChip, styles.todayChipBad]}
              onPress={() => router.push('/(trainer)/clients')}
            >
              <Ionicons name="cash" size={13} color={colors.danger} />
              <Text style={[styles.todayChipText, { color: colors.danger }]}>
                {overdueCount} vencido(s)
              </Text>
            </Pressable>
          ) : null}
          {inactiveClients.length > 0 ? (
            <Pressable style={styles.todayChip} onPress={handleOpenCopilot}>
              <Ionicons name="alert-circle" size={13} color={colors.warning} />
              <Text style={[styles.todayChipText, { color: colors.warning }]}>
                {inactiveClients.length} en riesgo
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Atajos: lo más usado, a un toque */}
      <View style={styles.quickRow}>
        <Pressable
          style={[styles.quickBtn, copilotOpen && styles.quickBtnActive]}
          onPress={handleOpenCopilot}
        >
          <CopilotMark size={20} />
          <Text style={styles.quickLabel}>Copiloto</Text>
        </Pressable>
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
        <Pressable
          style={[styles.quickBtn, paysReminded && { opacity: 0.5 }]}
          onPress={handleRemindAllPayments}
          disabled={remindingPays || paysReminded}
        >
          <View>
            <Ionicons name="cash-outline" size={20} color={colors.primary} />
            {duePayClients.length > 0 && !paysReminded ? (
              <View style={styles.quickBadge}>
                <Text style={styles.quickBadgeText}>{duePayClients.length}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.quickLabel}>
            {paysReminded ? 'Pagos avisados ✓' : 'Recordar pagos'}
          </Text>
        </Pressable>
      </View>

      {loadError ? (
        <Card style={[styles.section, { borderColor: colors.danger }]}>
          <Text style={[styles.sectionTitle, { color: colors.danger }]}>Error al cargar datos</Text>
          <Text style={styles.mutedText}>{loadError}</Text>
        </Card>
      ) : null}

      {copilotOpen ? (
        <Card accent style={styles.section}>
          <View style={styles.titleRow}>
            <CopilotMark size={16} />
            <Text style={styles.sectionTitle}>Copiloto · análisis semanal</Text>
          </View>
          {loadingCopilot || !copilotReport ? (
            <Text style={styles.mutedText}>Analizando tu grupo...</Text>
          ) : (
            <>
              <Text style={styles.copilotMeta}>
                {copilotReport.checkinsThisWeek}/{copilotReport.totalClients} check-ins recibidos
                esta semana
              </Text>
              {copilotReport.highlights.map((h) => (
                <View key={h} style={styles.copilotHighlight}>
                  <Ionicons name="trophy-outline" size={14} color={colors.primary} />
                  <Text style={styles.copilotHighlightText}>{h}</Text>
                </View>
              ))}
              {copilotReport.attention.length === 0 ? (
                <Text style={styles.mutedText}>
                  Todo en orden: nadie necesita atención especial esta semana.
                </Text>
              ) : (
                copilotReport.attention.map((a) => (
                  <Pressable
                    key={a.uid}
                    style={styles.copilotRow}
                    onPress={() => router.push(`/(trainer)/clients/${a.uid}`)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.logClient}>{a.name}</Text>
                      <Text style={styles.copilotReasons}>{a.reasons.join(' · ')}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                  </Pressable>
                ))
              )}
            </>
          )}
        </Card>
      ) : null}

      {requests.length > 0 ? (
        <Card accent style={styles.section}>
          <View style={styles.titleRow}>
            <Ionicons name="person-add-outline" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>
              Solicitudes de alumnos ({requests.length})
            </Text>
          </View>
          <Text style={styles.subtleHint}>Revisa y acepta a quién quieras en tu grupo.</Text>
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
      ) : null}

      <View style={styles.statsRow}>
        <StatTile icon="people" value={String(clients.length)} label="Clientes" />
        <StatTile
          icon="barbell"
          value={String(wk.thisWeek)}
          label="Entrenos (semana)"
          highlight={wk.thisWeek > 0}
        />
        <StatTile
          icon="alert-circle"
          value={String(inactiveClients.length)}
          label="Inactivos"
        />
      </View>
      {wk.thisWeek > 0 || wk.lastWeek > 0 ? (
        <Text style={styles.weekLine}>
          {wk.lastWeek > 0
            ? `${wk.thisWeek >= wk.lastWeek ? '▲' : '▼'} Semana pasada: ${wk.lastWeek} · `
            : ''}
          {wk.activeClients} alumno(s) han entrenado esta semana
        </Text>
      ) : null}

      {showBilling ? (
        <Pressable onPress={() => router.push('/(trainer)/clients')}>
          <Card style={styles.section}>
            <View style={styles.titleRow}>
              <Ionicons name="cash-outline" size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>Cobros del mes</Text>
            </View>
            <View style={styles.revenueRow}>
              <View style={styles.revenueBox}>
                <Text style={styles.revenueValue}>{incomeThisMonth} €</Text>
                <Text style={styles.revenueLabel}>Ingresado este mes</Text>
              </View>
              <View style={styles.revenueBox}>
                <Text style={[styles.revenueValue, { color: '#C9902B' }]}>{pendingAmount} €</Text>
                <Text style={styles.revenueLabel}>Pendiente</Text>
              </View>
              {projected30 > 0 ? (
                <View style={styles.revenueBox}>
                  <Text style={[styles.revenueValue, { color: colors.textMuted }]}>
                    {projected30} €
                  </Text>
                  <Text style={styles.revenueLabel}>
                    Previsto 30 días ({upcoming.length})
                  </Text>
                </View>
              ) : null}
            </View>
            {nextPayment ? (
              <Pressable
                onPress={() => router.push(`/(trainer)/clients/${nextPayment.uid}`)}
                style={styles.nextPayRow}
                hitSlop={4}
              >
                <Avatar name={nextPayment.name} photoURL={nextPayment.photoURL} size={30} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextPayLabel}>Próximo cobro</Text>
                  <Text style={styles.nextPayName} numberOfLines={1}>
                    {nextPayment.name}
                    {nextPayment.monthlyFeeEur ? ` · ${nextPayment.monthlyFeeEur} €` : ''}
                  </Text>
                </View>
                <Text style={styles.nextPayDate}>
                  {new Date(nextPayment.nextPaymentDate!).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </Text>
              </Pressable>
            ) : null}
            <View style={styles.countsRow}>
              {PAYMENT_STATUSES.filter((p) => payCounts[p]).map((p) => (
                <View key={p} style={styles.countChip}>
                  <View
                    style={[styles.dot, { backgroundColor: PAY_TONE_COLOR[PAYMENT_STATUS_TONE[p]] }]}
                  />
                  <Text style={styles.countText}>
                    {payCounts[p]} {PAYMENT_STATUS_LABEL[p]}
                  </Text>
                </View>
              ))}
            </View>
            {overdueCount > 0 || dueSoonCount > 0 ? (
              <Pressable
                onPress={() => setPayListOpen(true)}
                style={styles.dueBanner}
                hitSlop={6}
              >
                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                <Text style={styles.dueText}>
                  {overdueCount > 0
                    ? `${overdueCount} pago(s) vencido(s)`
                    : `${dueSoonCount} pago(s) esta semana`}
                  {overdueCount > 0 && dueSoonCount > 0 ? ` · ${dueSoonCount} esta semana` : ''}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={colors.danger} />
              </Pressable>
            ) : null}
          </Card>
        </Pressable>
      ) : null}

      <Card style={styles.section}>
        <View style={styles.titleRow}>
          <Ionicons name="pulse-outline" size={16} color={colors.primary} />
          <Text style={styles.sectionTitle}>Actividad reciente</Text>
        </View>
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
                    {log.dayName} · {new Date(log.date).toLocaleDateString('es-ES')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
              </Pressable>
            );
          })
        )}
      </Card>

      {/* Lista de alumnos con pago pendiente/vencido (desde la alerta roja). */}
      <Modal
        visible={payListOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPayListOpen(false)}
      >
        <View style={styles.payBackdrop}>
          <View style={styles.paySheet}>
            <View style={styles.payHeader}>
              <Text style={styles.sectionTitle}>Pagos pendientes ({duePayClients.length})</Text>
              <Pressable onPress={() => setPayListOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            {duePayClients.length === 0 ? (
              <Text style={styles.mutedText}>No hay pagos pendientes.</Text>
            ) : (
              duePayClients.map((c) => (
                <Pressable
                  key={c.uid}
                  onPress={() => {
                    setPayListOpen(false);
                    router.push(`/(trainer)/clients/${c.uid}`);
                  }}
                  style={styles.payRow}
                >
                  <Avatar name={c.name} photoURL={c.photoURL} size={38} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.logClient}>{c.name}</Text>
                    <Text style={styles.payMeta}>
                      {c.paymentStatus ? PAYMENT_STATUS_LABEL[c.paymentStatus] : 'Pendiente'}
                      {c.monthlyFeeEur ? ` · ${c.monthlyFeeEur} €` : ''}
                      {c.nextPaymentDate
                        ? ` · vence ${new Date(c.nextPaymentDate).toLocaleDateString('es-ES')}`
                        : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                </Pressable>
              ))
            )}
            <Button
              title="Avisar a todos"
              onPress={() => {
                setPayListOpen(false);
                handleRemindAllPayments();
              }}
              style={{ marginTop: spacing.md }}
            />
          </View>
        </View>
      </Modal>

    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  greetingLabel: { ...typography.label, color: colors.primary, textTransform: 'uppercase' },
  greeting: { ...typography.h1, color: colors.text, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  weekLine: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },
  quickRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  todayStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  todayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  todayChipGood: { borderColor: '#2E7D5B' },
  todayChipWarn: { borderColor: colors.hairline, backgroundColor: colors.primaryMuted },
  todayChipBad: { borderColor: colors.danger },
  todayChipText: { ...typography.small, fontFamily: fonts.semiBold, fontSize: 11 },
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
  quickBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  copilotMeta: {
    ...typography.small,
    color: colors.primaryBright,
    fontFamily: fonts.semiBold,
    marginBottom: spacing.sm,
  },
  copilotHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  copilotHighlightText: { ...typography.small, color: colors.text, flex: 1 },
  copilotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  copilotReasons: { ...typography.small, color: colors.warning, marginTop: 2, fontSize: 11 },
  section: { marginBottom: spacing.md },
  revenueRow: { flexDirection: 'row', gap: spacing.sm },
  revenueBox: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  revenueValue: { ...typography.h2, color: '#2E7D5B', fontFamily: fonts.heading },
  revenueLabel: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  nextPayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nextPayLabel: { ...typography.label, color: colors.primary, textTransform: 'uppercase' },
  nextPayName: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, marginTop: 1 },
  nextPayDate: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  countsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  countChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  countText: { ...typography.small, color: colors.textMuted, fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dueText: { ...typography.small, color: colors.danger, fontFamily: fonts.semiBold, flex: 1 },
  payBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  paySheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  payHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  payMeta: { ...typography.small, color: colors.danger, marginTop: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
  reminderBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
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
  alertText: { ...typography.small, color: colors.warning, marginTop: 2 },
  mutedText: { ...typography.small, color: colors.textFaint },
});
