import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ScreenContainer } from '../../components/ScreenContainer';
import { StatTile } from '../../components/StatTile';
import { TextField } from '../../components/TextField';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import {
  createChallenge,
  endChallenge,
  getActiveChallenge,
} from '../../lib/firestore/challenges';
import { getClientsForTrainer, updateClientPaymentStatus } from '../../lib/firestore/users';
import { getPaymentsForTrainer } from '../../lib/firestore/payments';
import {
  approveJoinRequest,
  deleteJoinRequest,
  getJoinRequestsForTrainer,
} from '../../lib/firestore/joinRequests';
import { getWorkoutLogsForTrainer } from '../../lib/firestore/workoutLogs';
import { notifyUser } from '../../lib/notifications';
import { getCached, setCached } from '../../lib/screenCache';
import { sessionsThisWeek } from '../../lib/stats';
import { fonts, colors, radius, spacing, typography } from '../../lib/theme';
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  type Challenge,
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
  challenge: Challenge | null;
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
  const [remindersSent, setRemindersSent] = useState<Set<string>>(new Set());
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(cached?.challenge ?? null);
  const [challengeTitle, setChallengeTitle] = useState('');
  const [challengeWeeks, setChallengeWeeks] = useState('4');
  const [savingChallenge, setSavingChallenge] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      let cancelled = false;
      (async () => {
        try {
          const [clientData, logData, challengeData, requestData, paymentData] = await Promise.all([
            getClientsForTrainer(profile.uid),
            getWorkoutLogsForTrainer(profile.uid),
            getActiveChallenge(profile.uid),
            getJoinRequestsForTrainer(profile.uid),
            getPaymentsForTrainer(profile.uid),
          ]);
          if (cancelled) return;
          setClients(clientData);
          setLogs(logData);
          setChallenge(challengeData);
          setRequests(requestData);
          setPayments(paymentData);
          setCached(cacheKey, {
            clients: clientData,
            logs: logData,
            requests: requestData,
            payments: paymentData,
            challenge: challengeData,
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

  const weekSessions = sessionsThisWeek(logs);
  const byId = (id: string) => clients.find((c) => c.uid === id);

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

  const handleStartChallenge = async () => {
    if (!profile || !challengeTitle.trim()) return;
    setSavingChallenge(true);
    try {
      const weeks = Math.max(1, Number(challengeWeeks) || 4);
      const start = Date.now();
      await createChallenge({
        trainerId: profile.uid,
        title: challengeTitle.trim(),
        startDate: start,
        endDate: start + weeks * 7 * 24 * 60 * 60 * 1000,
      });
      setChallengeTitle('');
      setChallenge(await getActiveChallenge(profile.uid));
      clients.forEach((c) => notifyUser(c.uid, 'Nuevo reto del grupo', challengeTitle.trim()));
      showToast('Reto lanzado');
    } finally {
      setSavingChallenge(false);
    }
  };

  const handleEndChallenge = async () => {
    if (!challenge) return;
    await endChallenge(challenge.id);
    setChallenge(null);
  };

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

  const handleSendReminder = async (client: UserProfile) => {
    if (!profile) return;
    setSendingReminder(client.uid);
    try {
      await notifyUser(
        client.uid,
        'Te echamos de menos',
        `${client.name.split(' ')[0]}, hace tiempo que no registras entrenamientos. ¡Retomemos el ritmo!`
      );
      setRemindersSent((prev) => new Set(prev).add(client.uid));
      showToast('Recordatorio enviado');
    } finally {
      setSendingReminder(null);
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

      {loadError ? (
        <Card style={[styles.section, { borderColor: colors.danger }]}>
          <Text style={[styles.sectionTitle, { color: colors.danger }]}>Error al cargar datos</Text>
          <Text style={styles.mutedText}>{loadError}</Text>
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
          value={String(weekSessions)}
          label="Entrenos (semana)"
          highlight={weekSessions > 0}
        />
        <StatTile
          icon="alert-circle"
          value={String(inactiveClients.length)}
          label="Inactivos"
        />
      </View>

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
            </View>
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
              <View style={styles.dueBanner}>
                <Ionicons name="alert-circle-outline" size={15} color={colors.warning} />
                <Text style={styles.dueText}>
                  {overdueCount > 0
                    ? `${overdueCount} pago(s) vencido(s)`
                    : `${dueSoonCount} pago(s) esta semana`}
                  {overdueCount > 0 && dueSoonCount > 0 ? ` · ${dueSoonCount} esta semana` : ''}
                </Text>
              </View>
            ) : null}
          </Card>
        </Pressable>
      ) : null}

      <Card accent style={styles.section}>
        <View style={styles.rowBetween}>
          <View style={styles.titleRow}>
            <Ionicons name="trophy-outline" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>Reto del grupo</Text>
          </View>
        </View>
        {challenge ? (
          <>
            <Text style={styles.logClient}>{challenge.title}</Text>
            <Text style={styles.logDetail}>
              Hasta el {new Date(challenge.endDate).toLocaleDateString('es-ES')} · el ranking vive
              en la sección Social de tus alumnos.
            </Text>
            <Button
              title="Finalizar reto"
              variant="danger"
              onPress={handleEndChallenge}
              style={{ marginTop: spacing.sm }}
            />
          </>
        ) : (
          <>
            <TextField
              placeholder="Ej: Enero imparable: máximo de sesiones"
              value={challengeTitle}
              onChangeText={setChallengeTitle}
            />
            <TextField
              label="Duración (semanas)"
              keyboardType="number-pad"
              value={challengeWeeks}
              onChangeText={setChallengeWeeks}
            />
            <Button
              title="Lanzar reto"
              onPress={handleStartChallenge}
              loading={savingChallenge}
              disabled={!challengeTitle.trim()}
            />
          </>
        )}
      </Card>

      <Card style={styles.section}>
        <View style={styles.titleRow}>
          <Ionicons name="pulse-outline" size={16} color={colors.primary} />
          <Text style={styles.sectionTitle}>Actividad reciente</Text>
        </View>
        {logs.length === 0 ? (
          <EmptyState title="Todavía no hay entrenamientos registrados" />
        ) : (
          logs.slice(0, 6).map((log) => {
            const client = byId(log.clientId);
            return (
              <Pressable
                key={log.id}
                onPress={() => router.push(`/(trainer)/clients/${log.clientId}`)}
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

      <Card style={styles.section}>
        <View style={styles.titleRow}>
          <Ionicons name="notifications-outline" size={16} color={colors.warning} />
          <Text style={styles.sectionTitle}>Necesitan un empujón</Text>
        </View>
        <Text style={styles.subtleHint}>Sin entrenar en +{INACTIVE_DAYS_THRESHOLD} días</Text>
        {inactiveClients.length === 0 ? (
          <Text style={styles.mutedText}>Todos tus clientes están al día. 👏</Text>
        ) : (
          inactiveClients.map((client) => (
            <View key={client.uid} style={styles.activityRow}>
              <Avatar name={client.name} photoURL={client.photoURL} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={styles.logClient}>{client.name}</Text>
                <Text style={styles.alertText}>
                  {lastLogByClient.get(client.uid)
                    ? `Última vez: ${new Date(lastLogByClient.get(client.uid)!).toLocaleDateString('es-ES')}`
                    : 'Sin entrenamientos aún'}
                </Text>
              </View>
              <Button
                title={remindersSent.has(client.uid) ? 'Enviado' : 'Recordar'}
                variant="secondary"
                onPress={() => handleSendReminder(client)}
                loading={sendingReminder === client.uid}
                disabled={remindersSent.has(client.uid)}
                style={styles.reminderBtn}
              />
            </View>
          ))
        )}
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  greetingLabel: { ...typography.label, color: colors.primary, textTransform: 'uppercase' },
  greeting: { ...typography.h1, color: colors.text, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
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
  dueText: { ...typography.small, color: colors.warning, fontFamily: fonts.semiBold },
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
