import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import {
  getClientsForTrainer,
  registerClientPayment,
  subscribeClientsForTrainer,
  updateClientPaymentStatus,
} from '../../lib/firestore/users';
import {
  createPayment,
  deletePayment,
  getPaymentsForTrainer,
  updatePayment,
} from '../../lib/firestore/payments';
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
/** Suma meses naturales a un timestamp (para la próxima renovación). */
function addMonths(base: number, months: number): number {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}
const PAY_TONE_COLOR: Record<'good' | 'warn' | 'bad' | 'muted', string> = {
  good: colors.success,
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
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [incomeScope, setIncomeScope] = useState<'month' | 'all'>('month');
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [editPayId, setEditPayId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [savingPay, setSavingPay] = useState(false);
  const [confirmingPayId, setConfirmingPayId] = useState<string | null>(null);
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

  // Alta/baja de alumnos en vivo: al aceptar a uno nuevo aparece aquí al
  // instante, sin refrescar el panel.
  useEffect(() => {
    if (!profile) return;
    const unsubscribe = subscribeClientsForTrainer(profile.uid, setClients);
    return unsubscribe;
  }, [profile]);

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
  const monthPayments = payments
    .filter((p) => p.date >= monthStart.getTime())
    .sort((a, b) => b.date - a.date);
  const incomeThisMonth = monthPayments.reduce((s, p) => s + (p.amountEur || 0), 0);
  // Historial completo de ingresos (todos los pagos) + total acumulado.
  const allPaymentsSorted = [...payments].sort((a, b) => b.date - a.date);
  const incomeAllTime = payments.reduce((s, p) => s + (p.amountEur || 0), 0);
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
      // Un fallo puntual (push de un alumno sin token) NO debe tumbar el resto:
      // se avisa a todos los que se pueda y se cuentan los envíos con éxito.
      const results = await Promise.allSettled(
        duePayClients.map((c) =>
          notifyUser(
            c.uid,
            'Recordatorio de pago',
            `Hola ${c.name.split(' ')[0]}, tienes un pago pendiente de tu suscripción. ¡Gracias!`
          )
        )
      );
      const sent = results.filter((r) => r.status === 'fulfilled').length;
      if (sent > 0) {
        setPaysReminded(true);
        showToast(`Recordatorio enviado a ${sent} alumno(s)`);
      } else {
        showToast('No se pudo enviar el recordatorio. Reinténtalo.');
      }
    } finally {
      setRemindingPays(false);
    }
  };

  // Corregir un pago ya registrado (ajustar importe por un error).
  const handleSavePayEdit = async (id: string) => {
    const amount = Number(editAmount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount < 0) {
      showToast('Importe no válido');
      return;
    }
    setSavingPay(true);
    try {
      await updatePayment(id, amount);
      setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, amountEur: amount } : p)));
      setEditPayId(null);
      setEditAmount('');
      showToast('Pago actualizado');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo actualizar');
    } finally {
      setSavingPay(false);
    }
  };

  // Eliminar un pago registrado por error.
  const handleDeletePayment = async (id: string) => {
    setSavingPay(true);
    try {
      await deletePayment(id);
      setPayments((prev) => prev.filter((p) => p.id !== id));
      if (editPayId === id) {
        setEditPayId(null);
        setEditAmount('');
      }
      showToast('Pago eliminado');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo eliminar');
    } finally {
      setSavingPay(false);
    }
  };

  // El coach confirma manualmente un cobro pendiente (pago fuera de la
  // plataforma): marca "Pagado", empuja la renovación un mes y lo registra en
  // ingresos. Los pagos por Stripe pasan a cobrado solos (webhook), sin esto.
  const handleConfirmPayment = async (c: UserProfile) => {
    if (!profile) return;
    setConfirmingPayId(c.uid);
    try {
      const base =
        c.nextPaymentDate && c.nextPaymentDate > Date.now() ? c.nextPaymentDate : Date.now();
      const nextPaymentDate = addMonths(base, 1);
      await registerClientPayment(c.uid, nextPaymentDate);
      const pay = await createPayment({
        trainerId: profile.uid,
        clientId: c.uid,
        amountEur: c.monthlyFeeEur ?? 0,
        date: Date.now(),
      });
      // Refresca el estado local: sale de "pendientes" y suma a ingresos.
      setClients((prev) =>
        prev.map((x) =>
          x.uid === c.uid
            ? { ...x, paymentStatus: 'paid', nextPaymentDate, paymentReportedAt: undefined }
            : x
        )
      );
      setPayments((prev) => [
        {
          id: pay,
          trainerId: profile.uid,
          clientId: c.uid,
          amountEur: c.monthlyFeeEur ?? 0,
          date: Date.now(),
          createdAt: Date.now(),
        },
        ...prev,
      ]);
      showToast(`Cobro de ${c.name.split(' ')[0]} confirmado`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo confirmar');
    } finally {
      setConfirmingPayId(null);
    }
  };

  // Historial agrupado por alumno (para la vista "Histórico" tipo Excel).
  const incomeByClient = (() => {
    const m = new Map<string, import('../../lib/types').Payment[]>();
    for (const p of allPaymentsSorted) {
      const arr = m.get(p.clientId) ?? [];
      arr.push(p);
      m.set(p.clientId, arr);
    }
    return [...m.entries()]
      .map(([cid, pays]) => ({
        cid,
        name: byId(cid)?.name ?? 'Cliente',
        photoURL: byId(cid)?.photoURL,
        total: pays.reduce((s, p) => s + (p.amountEur || 0), 0),
        pays,
      }))
      .sort((a, b) => b.total - a.total);
  })();

  // Una fila de pago editable (fecha + importe con lápiz/papelera).
  const renderPayRow = (p: import('../../lib/types').Payment, showAvatar: boolean) => {
    const client = byId(p.clientId);
    const editing = editPayId === p.id;
    return (
      <View key={p.id} style={styles.payRow}>
        {showAvatar ? <Avatar name={client?.name} photoURL={client?.photoURL} size={34} /> : null}
        <View style={{ flex: 1 }}>
          {showAvatar ? <Text style={styles.logClient}>{client?.name ?? 'Cliente'}</Text> : null}
          <Text style={styles.logDetail}>{new Date(p.date).toLocaleDateString('es-ES')}</Text>
        </View>
        {editing ? (
          <>
            <TextInput
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="decimal-pad"
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor={colors.textFaint}
              autoFocus
            />
            <Text style={styles.amountEuro}>€</Text>
            <Pressable
              onPress={() => handleSavePayEdit(p.id)}
              disabled={savingPay}
              style={styles.payIconBtn}
              hitSlop={6}
            >
              <Ionicons name="checkmark" size={20} color={colors.success} />
            </Pressable>
            <Pressable
              onPress={() => {
                setEditPayId(null);
                setEditAmount('');
              }}
              style={styles.payIconBtn}
              hitSlop={6}
            >
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.payAmount}>{p.amountEur} €</Text>
            <Pressable
              onPress={() => {
                setEditPayId(p.id);
                setEditAmount(String(p.amountEur ?? ''));
              }}
              style={styles.payIconBtn}
              hitSlop={6}
            >
              <Ionicons name="create-outline" size={19} color={colors.primary} />
            </Pressable>
            <Pressable
              onPress={() => handleDeletePayment(p.id)}
              disabled={savingPay}
              style={styles.payIconBtn}
              hitSlop={6}
            >
              <Ionicons name="trash-outline" size={19} color={colors.danger} />
            </Pressable>
          </>
        )}
      </View>
    );
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
              <Ionicons name="checkmark-circle" size={13} color={colors.success} />
              <Text style={[styles.todayChipText, { color: colors.success }]}>
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

      {/* Acceso a la agenda completa (calendario mensual + tareas y objetivos).
          Ya no ocupa una pestaña propia: los cobros clave están arriba en Inicio,
          y aquí se llega al mes completo y a las tareas de un toque. */}
      <Pressable onPress={() => router.push('/(trainer)/agenda')} style={styles.agendaEntry}>
        <View style={styles.agendaIcon}>
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.agendaTitle}>Calendario y tareas</Text>
          <Text style={styles.agendaSub}>Cobros, ciclos y tus recordatorios, mes a mes.</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </Pressable>

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
        <StatTile icon="barbell" value={String(wk.thisWeek)} label="Entrenos (semana)" />
        <StatTile
          icon="alert-circle"
          value={String(inactiveClients.length)}
          label="Inactivos"
        />
      </View>
      {showBilling ? (
        <Card style={styles.section}>
          <View style={styles.titleRow}>
            <Ionicons name="cash-outline" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>Cobros del mes</Text>
          </View>
          <Text style={styles.subtleHint}>Toca cada dato para ver y gestionar de quién se trata.</Text>
          <View style={styles.revenueRow}>
            <Pressable style={styles.revenueBox} onPress={() => setIncomeOpen(true)}>
              <Text style={styles.revenueValue}>{incomeThisMonth} €</Text>
              <Text style={styles.revenueLabel}>Ingresado este mes</Text>
              <Ionicons
                name="create-outline"
                size={13}
                color={colors.textFaint}
                style={styles.revenueBoxIcon}
              />
            </Pressable>
            <Pressable style={styles.revenueBox} onPress={() => setPayListOpen(true)}>
              <Text style={[styles.revenueValue, { color: '#C9902B' }]}>{pendingAmount} €</Text>
              <Text style={styles.revenueLabel}>Pendiente ({duePayClients.length})</Text>
              <Ionicons
                name="chevron-forward"
                size={13}
                color={colors.textFaint}
                style={styles.revenueBoxIcon}
              />
            </Pressable>
            {projected30 > 0 ? (
              <Pressable style={styles.revenueBox} onPress={() => setUpcomingOpen(true)}>
                <Text style={[styles.revenueValue, { color: colors.textMuted }]}>
                  {projected30} €
                </Text>
                <Text style={styles.revenueLabel}>
                  Previsto 30 días ({upcoming.length})
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={13}
                  color={colors.textFaint}
                  style={styles.revenueBoxIcon}
                />
              </Pressable>
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
          {duePayClients.length > 0 ? (
            <Pressable
              onPress={() => setPayListOpen(true)}
              style={styles.dueBanner}
              hitSlop={6}
            >
              <Ionicons name="alert-circle" size={15} color={colors.danger} />
              <Text style={styles.dueText}>
                {duePayClients.length} pago{duePayClients.length === 1 ? '' : 's'} pendiente
                {duePayClients.length === 1 ? '' : 's'}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.danger} />
            </Pressable>
          ) : null}
        </Card>
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
                <View key={c.uid} style={styles.payRow}>
                  <Pressable
                    onPress={() => {
                      setPayListOpen(false);
                      router.push(`/(trainer)/clients/${c.uid}`);
                    }}
                    style={styles.payRowMain}
                  >
                    <Avatar name={c.name} photoURL={c.photoURL} size={38} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.logClient}>{c.name}</Text>
                      <Text style={styles.payMeta}>
                        {c.paymentReportedAt
                          ? 'Dice que ya pagó · confirma'
                          : c.paymentStatus
                            ? PAYMENT_STATUS_LABEL[c.paymentStatus]
                            : 'Pendiente'}
                        {c.monthlyFeeEur ? ` · ${c.monthlyFeeEur} €` : ''}
                        {c.nextPaymentDate
                          ? ` · vence ${new Date(c.nextPaymentDate).toLocaleDateString('es-ES')}`
                          : ''}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => handleConfirmPayment(c)}
                    disabled={confirmingPayId === c.uid}
                    style={styles.confirmPayBtn}
                    hitSlop={6}
                  >
                    <Ionicons name="checkmark-circle" size={15} color={colors.success} />
                    <Text style={styles.confirmPayText}>
                      {confirmingPayId === c.uid ? '...' : 'Cobrado'}
                    </Text>
                  </Pressable>
                </View>
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

      {/* Gestión de ingresos del mes: ver, corregir importe o eliminar un pago. */}
      <Modal
        visible={incomeOpen}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setIncomeOpen(false);
          setEditPayId(null);
        }}
      >
        <View style={styles.payBackdrop}>
          <View style={styles.paySheet}>
            <View style={styles.payHeader}>
              <Text style={styles.sectionTitle}>Ingresos</Text>
              <Pressable
                onPress={() => {
                  setIncomeOpen(false);
                  setEditPayId(null);
                }}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            {/* Conmutador: ingresos del mes o historial completo. */}
            <View style={styles.scopeSeg}>
              {(['month', 'all'] as const).map((sc) => (
                <Pressable
                  key={sc}
                  onPress={() => {
                    setIncomeScope(sc);
                    setEditPayId(null);
                  }}
                  style={[styles.scopeBtn, incomeScope === sc && styles.scopeBtnOn]}
                >
                  <Text
                    style={[styles.scopeText, incomeScope === sc && styles.scopeTextOn]}
                  >
                    {sc === 'month' ? 'Este mes' : 'Histórico'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                {incomeScope === 'month' ? 'Ingresado este mes' : 'Total ingresado hasta la fecha'}
              </Text>
              <Text style={styles.totalValue}>
                {(incomeScope === 'month' ? incomeThisMonth : incomeAllTime).toLocaleString('es-ES')}{' '}
                €
              </Text>
            </View>
            <Text style={styles.subtleHint}>
              Ajusta el importe o elimina un pago si hubo un error.
            </Text>
            {incomeScope === 'month' ? (
              monthPayments.length === 0 ? (
                <Text style={styles.mutedText}>Aún no hay pagos registrados este mes.</Text>
              ) : (
                <ScrollView style={{ maxHeight: 400 }}>
                  {monthPayments.map((p) => renderPayRow(p, true))}
                </ScrollView>
              )
            ) : incomeByClient.length === 0 ? (
              <Text style={styles.mutedText}>Aún no hay pagos registrados.</Text>
            ) : (
              // Histórico agrupado por alumno (tipo Excel): cada alumno con su
              // total y el desglose de sus pagos.
              <ScrollView style={{ maxHeight: 420 }}>
                {incomeByClient.map((g) => (
                  <View key={g.cid} style={styles.clientGroup}>
                    <View style={styles.clientGroupHead}>
                      <Avatar name={g.name} photoURL={g.photoURL} size={34} />
                      <Text style={styles.clientGroupName}>{g.name}</Text>
                      <Text style={styles.clientGroupTotal}>
                        {g.total.toLocaleString('es-ES')} €
                      </Text>
                    </View>
                    {g.pays.map((p) => renderPayRow(p, false))}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Lista de renovaciones previstas en los próximos 30 días. */}
      <Modal
        visible={upcomingOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setUpcomingOpen(false)}
      >
        <View style={styles.payBackdrop}>
          <View style={styles.paySheet}>
            <View style={styles.payHeader}>
              <Text style={styles.sectionTitle}>Previsto 30 días ({projected30} €)</Text>
              <Pressable onPress={() => setUpcomingOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            {upcoming.length === 0 ? (
              <Text style={styles.mutedText}>No hay renovaciones previstas en 30 días.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 420 }}>
                {upcoming
                  .slice()
                  .sort((a, b) => (a.nextPaymentDate ?? 0) - (b.nextPaymentDate ?? 0))
                  .map((c) => (
                    <Pressable
                      key={c.uid}
                      onPress={() => {
                        setUpcomingOpen(false);
                        router.push(`/(trainer)/clients/${c.uid}`);
                      }}
                      style={styles.payRow}
                    >
                      <Avatar name={c.name} photoURL={c.photoURL} size={38} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.logClient}>{c.name}</Text>
                        <Text style={styles.logDetail}>
                          Renueva{' '}
                          {c.nextPaymentDate
                            ? new Date(c.nextPaymentDate).toLocaleDateString('es-ES', {
                                day: 'numeric',
                                month: 'short',
                              })
                            : ''}
                        </Text>
                      </View>
                      <Text style={styles.payAmount}>{c.monthlyFeeEur} €</Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                    </Pressable>
                  ))}
              </ScrollView>
            )}
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
  quickRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  agendaEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.primaryMuted,
    marginBottom: spacing.md,
  },
  agendaIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agendaTitle: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  agendaSub: { ...typography.small, color: colors.textFaint, marginTop: 1 },
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
  todayChipGood: { borderColor: colors.success },
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
  revenueValue: { ...typography.h2, color: colors.success, fontFamily: fonts.heading },
  revenueLabel: { ...typography.small, color: colors.textMuted, marginTop: 2, textAlign: 'center' },
  revenueBoxIcon: { position: 'absolute', top: 6, right: 6 },
  amountInput: {
    width: 64,
    ...typography.body,
    color: colors.text,
    fontFamily: fonts.semiBold,
    textAlign: 'right',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  amountEuro: { ...typography.body, color: colors.textMuted, fontFamily: fonts.semiBold },
  payAmount: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  payIconBtn: { padding: 4 },
  scopeSeg: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.sm,
  },
  scopeBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm },
  scopeBtnOn: { backgroundColor: colors.primary },
  scopeText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  scopeTextOn: { color: colors.onPrimary },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  totalLabel: { ...typography.small, color: colors.textMuted, flex: 1 },
  totalValue: { ...typography.h3, color: colors.success, fontFamily: fonts.heading },
  clientGroup: { marginBottom: spacing.sm },
  clientGroupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  clientGroupName: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, flex: 1 },
  clientGroupTotal: { ...typography.body, color: colors.success, fontFamily: fonts.heading },
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
