import { repartoDelMes, resumenDeCobros } from '../../lib/cobros';
import {
  cobroValido,
  idDePagadorExterno,
  importeEscrito,
  LARGO_DEL_NOMBRE,
  limpiarNombreDePagador,
  nombreDelPagador,
} from '../../lib/cobrosExternos';
import { guardarIngresosOcultos, importeVisible, ingresosOcultos } from '../../lib/ocultarIngresos';
import { frase } from '../../lib/idioma';
import { diaMes, fechaNumerica, inicioDelDia } from '../../lib/fechas';
import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../../components/Texto';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { TextField } from '../../components/TextField';
import { DashboardSkeleton } from '../../components/Skeleton';
import { TrialBanner } from '../../components/TrialBanner';
import { UpgradePopup } from '../../components/UpgradeCard';
import { getCoachTasks, updateCoachTask } from '../../lib/firestore/coachTasks';
import { CollapsibleCard } from '../../components/CollapsibleCard';
import { CountUp } from '../../components/CountUp';
import { PressableScale } from '../../components/PressableScale';
import { FadeIn } from '../../components/FadeIn';
import { ProgressRing } from '../../components/ProgressRing';
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
  deletePaymentsOfPayer,
  getPaymentsForTrainer,
  updatePayment,
} from '../../lib/firestore/payments';
import { FREE_CLIENT_LIMIT, trainerAtFreeLimit } from '../../lib/subscription';
import { billingAnchorOf, nextBillingDate, periodsOwed } from '../../lib/billing';
import { approveClientOnServer } from '../../lib/join';
import {
  approveJoinRequest,
  deleteJoinRequest,
  getJoinRequestsForTrainer,
} from '../../lib/firestore/joinRequests';
import { confirmar } from '../../lib/confirmar';
import { getWorkoutLogsForTrainer } from '../../lib/firestore/workoutLogs';
import { notifyUser } from '../../lib/notifications';
import { getCached, setCached } from '../../lib/screenCache';
import { weekComparison } from '../../lib/stats';
import { Sheet } from '../../components/Sheet';
import { fonts, colors, radius, spacing, typography, tabularNums } from '../../lib/theme';
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  type JoinRequest,
  type UserProfile,
  type WorkoutLog,
} from '../../lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Suma meses naturales a un timestamp (para la próxima renovación). */
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
  // El ojo: marca del aparato, no de la cuenta (ver lib/ocultarIngresos.ts).
  const [ocultos, setOcultos] = useState(false);
  // Alta de un cobro de alguien que todavía no está en la app.
  const [nuevoCobroAbierto, setNuevoCobroAbierto] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoImporte, setNuevoImporte] = useState('');
  const [guardandoCobro, setGuardandoCobro] = useState(false);
  const [incomeScope, setIncomeScope] = useState<'month' | 'all'>('month');
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [editPayId, setEditPayId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [savingPay, setSavingPay] = useState(false);
  const [confirmingPayId, setConfirmingPayId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      let cancelled = false;
      (async () => {
        try {
          const [clientData, logData, requestData, paymentData, taskData] = await Promise.all([
            getClientsForTrainer(profile.uid),
            getWorkoutLogsForTrainer(profile.uid),
            getJoinRequestsForTrainer(profile.uid),
            getPaymentsForTrainer(profile.uid),
            getCoachTasks(profile.uid).catch(() => []),
          ]);
          if (cancelled) return;
          setClients(clientData);
          setLogs(logData);
          setTasks(taskData);
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
  // instante, sin refrescar el panel. Solo mientras el panel está delante.
  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      return subscribeClientsForTrainer(profile.uid, setClients, (e) =>
        showToast(frase`Alumnos en vivo no disponible: ${e.message}`)
      );
    }, [profile])
  );

  /*
   * El ojo, recordado del aparato.
   *
   * AQUÍ ARRIBA, CON LOS DEMÁS HOOKS, y no junto al código de cobros que es
   * donde se usa. Más abajo hay un `return` para el esqueleto de carga, y un
   * `useEffect` después de un return condicional se ejecuta unas veces sí y
   * otras no: React cuenta los hooks y, en cuanto el número cambia entre dos
   * renders, revienta la pantalla entera con el error 310. Pasó al escribir
   * esto, y el panel del entrenador se quedó en "Algo no ha ido bien".
   */
  useEffect(() => {
    // Sin bloquear el arranque: mientras no se sepa, se enseñan.
    ingresosOcultos().then(setOcultos).catch(() => {});
  }, []);

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
  // Tareas de hoy: las del día sin terminar. Estaban solo en la agenda, y una
  // tarea que hay que ir a buscar es una tarea que se olvida.
  const hoyCero = inicioDelDia(now);
  const tareasHoy = tasks
    .filter((t) => !t.done && t.scope === 'day' && (t.dueDate ?? hoyCero) <= hoyCero)
    .sort((a, b) => Number(b.flagged ?? false) - Number(a.flagged ?? false))
    .slice(0, 4);
  const byId = (id: string) => clients.find((c) => c.uid === id);
  // Alumnos distintos que ya han entrenado HOY (para el panel "Hoy").
  const trainedToday = new Set(
    logs.filter((l) => l.date >= hoyCero).map((l) => l.clientId)
  ).size;

  // Los cobros, enteros y comprobados aparte (ver lib/cobros.ts).
  const cobros = resumenDeCobros(clients, payments, now);
  // Lo cobrado frente a lo que tocaba: una barra en vez de tres cajas.
  const reparto = repartoDelMes(cobros.ingresoDelMes, cobros.importePendiente);
  /** Un importe, tapado si el ojo está cerrado. */
  const euros = (n: number) => importeVisible(n.toLocaleString('es-ES'), ocultos);


  const alternarOjo = () => {
    const siguiente = !ocultos;
    setOcultos(siguiente);
    void guardarIngresosOcultos(siguiente);
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

  // Un toque: recordatorio de pago a TODOS los alumnos con pago pendiente.
  const handleRemindAllPayments = async () => {
    if (cobros.aReclamar.length === 0) {
      showToast('No hay pagos pendientes');
      return;
    }
    setRemindingPays(true);
    try {
      // Un fallo puntual (push de un alumno sin token) NO debe tumbar el resto:
      // se avisa a todos los que se pueda y se cuentan los envíos con éxito.
      const results = await Promise.allSettled(
        cobros.aReclamar.map((c) =>
          notifyUser(
            c.uid,
            'Recordatorio de pago',
            frase`Hola ${c.name.split(' ')[0]}, tienes un pago pendiente de tu suscripción. ¡Gracias!`
          )
        )
      );
      const sent = results.filter((r) => r.status === 'fulfilled').length;
      if (sent > 0) {
        setPaysReminded(true);
        showToast(`Recordatorio enviado a ${sent} ${sent === 1 ? 'alumno' : 'alumnos'}`);
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
  /**
   * Registrar un cobro de alguien que no está en la app.
   *
   * Se guarda como un pago normal con un `clientId` sacado del nombre, así que
   * suma a los totales y sale en el histórico como cualquier otro. Ver
   * lib/cobrosExternos.ts.
   */
  const registrarCobroExterno = async () => {
    if (!profile) return;
    const nombre = limpiarNombreDePagador(nuevoNombre);
    const importe = importeEscrito(nuevoImporte);
    if (!cobroValido(nombre, importe)) return;
    setGuardandoCobro(true);
    try {
      const clientId = idDePagadorExterno(nombre);
      const id = await createPayment({
        trainerId: profile.uid,
        clientId,
        clientName: nombre,
        amountEur: importe,
        date: Date.now(),
      });
      setPayments((prev) => [
        { id, trainerId: profile.uid, clientId, clientName: nombre, amountEur: importe, date: Date.now(), createdAt: Date.now() },
        ...prev,
      ]);
      setNuevoNombre('');
      setNuevoImporte('');
      setNuevoCobroAbierto(false);
      showToast(frase`Cobro de ${nombre} registrado`);
    } catch {
      showToast('No se pudo registrar el cobro');
    } finally {
      setGuardandoCobro(false);
    }
  };

  /**
   * Borra del historial TODOS los cobros de un pagador.
   *
   * Para el que ya no está: sus cobros siguen sumando a los totales históricos
   * y ocupando una ficha en una lista que se mira para saber quién paga AHORA.
   */
  const borrarFichaDeCobros = async (clientId: string, nombre: string, cuantos: number) => {
    if (!profile) return;
    const aviso = frase`¿Borrar del historial los ${cuantos} cobros de ${nombre}? Esto no borra a nadie de tu grupo, solo sus cobros.`;
    if (!(await confirmar(aviso))) return;
    const antes = payments;
    setPayments((prev) => prev.filter((x) => x.clientId !== clientId));
    try {
      await deletePaymentsOfPayer(profile.uid, clientId);
      showToast(frase`Cobros de ${nombre} borrados`);
    } catch {
      setPayments(antes);
      showToast('No se pudieron borrar');
    }
  };

  const handleDeletePayment = async (id: string) => {
    // Un pago registrado es dinero cobrado a un alumno. Que desapareciera
    // porque el dedo rozó una papelera no es un fallo de diseño, es un fallo
    // de contabilidad.
    if (!(await confirmar('¿Eliminar este pago del historial de ingresos?'))) return;
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
      // El mes cobrado arranca en la fecha en que TOCABA pagar, no en la que
      // se paga: si no, cada retraso empuja el cobro y la fecha no vuelve.
      const anchor = c.billingAnchorDay ?? (c.nextPaymentDate ? billingAnchorOf(c.nextPaymentDate) : undefined);
      const nextPaymentDate = nextBillingDate(c.nextPaymentDate, anchor);
      await registerClientPayment(c.uid, nextPaymentDate, anchor ?? billingAnchorOf(nextPaymentDate));
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
      // Un cobro cubre UN mes. Si el alumno acumulaba varios impagos sigue
      // debiendo: mejor decirlo que dejar al coach creyendo que está al día.
      const pendientes = periodsOwed(nextPaymentDate);
      showToast(
        pendientes > 0
          ? frase`Cobro confirmado · a ${c.name.split(' ')[0]} le faltan ${pendientes} mensualidad(es)`
          : frase`Cobro de ${c.name.split(' ')[0]} confirmado`
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo confirmar');
    } finally {
      setConfirmingPayId(null);
    }
  };

  // Historial agrupado por alumno (para la vista "Histórico" tipo Excel).
  const incomeByClient = (() => {
    const m = new Map<string, import('../../lib/types').Payment[]>();
    for (const p of cobros.pagos) {
      const arr = m.get(p.clientId) ?? [];
      arr.push(p);
      m.set(p.clientId, arr);
    }
    return [...m.entries()]
      .map(([cid, pays]) => ({
        cid,
        name: nombreDelPagador(pays[0], byId(cid)),
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
        {showAvatar ? (
          <Avatar name={nombreDelPagador(p, client)} photoURL={client?.photoURL} size={34} />
        ) : null}
        <View style={{ flex: 1 }}>
          {showAvatar ? (
            <Text style={styles.logClient}>{nombreDelPagador(p, client)}</Text>
          ) : null}
          <Text style={styles.logDetail}>{fechaNumerica(p.date)}</Text>
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
            {/* Con coma, como el resto. Aquí salía "35.5 €" al lado de un
                total que decía "35,5 €": dos formatos distintos para el mismo
                número en la misma pantalla es lo que hace dudar de la cifra. */}
            <Text style={styles.payAmount}>{(p.amountEur ?? 0).toLocaleString('es-ES')} €</Text>
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
      {requests.length > 0 || cobros.vencidos > 0 ? (
        <FadeIn>
        <Card accent style={styles.section}>
          <View style={styles.titleRow}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.sectionTitle}>Necesita tu atención</Text>
          </View>
          {/* Abre aquí mismo la lista de quién debe, en vez de mandar a la
              pestaña de Clientes: desde ahí habría que buscar a mano quiénes
              son y volver. La respuesta a "¿quién me debe?" se da donde se
              hace la pregunta. */}
          {cobros.vencidos > 0 ? (
            <Pressable style={styles.attentionRow} onPress={() => setPayListOpen(true)}>
              <View style={[styles.attentionIcon, { backgroundColor: colors.dangerMuted }]}>
                <Ionicons name="cash-outline" size={17} color={colors.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.attentionTitle}>
                  {cobros.vencidos} pago{cobros.vencidos === 1 ? '' : 's'} vencido
                  {cobros.vencidos === 1 ? '' : 's'}
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

      {/* Lo bueno no es una alerta: se cuenta en una línea tranquila. */}
      {trainedToday > 0 ? (
        <View style={styles.goodNews}>
          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          <Text style={styles.goodNewsText}>
            {trainedToday} alumno{trainedToday === 1 ? '' : 's'} ha
            {trainedToday === 1 ? '' : 'n'} entrenado hoy
          </Text>
        </View>
      ) : null}

      {/* Atajos: lo más usado, a un toque */}

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
            </View>
          </View>
        </Card>
        </FadeIn>
      ) : null}

      {/* Las tareas de hoy, aquí y no solo en la agenda: una tarea que hay que
          ir a buscar es una tarea que se olvida. Se marcan desde aquí mismo. */}
      {tareasHoy.length > 0 ? (
        <FadeIn delay={175}>
          <Card style={styles.section}>
            <View style={styles.titleRow}>
              <Ionicons name="checkbox-outline" size={16} color={colors.primary} />
              <Text style={styles.sectionTitle}>Hoy</Text>
            </View>
            {tareasHoy.map((t) => (
              <PressableScale
                key={t.id}
                haptic
                style={styles.taskRow}
                onPress={async () => {
                  // Se tacha al momento y se guarda detrás: esperar a la red
                  // para ver un tic es lo que hace que una app parezca lenta.
                  setTasks((prev) =>
                    prev.map((x) => (x.id === t.id ? { ...x, done: true } : x))
                  );
                  try {
                    await updateCoachTask(t.id, { done: true, doneAt: Date.now() });
                  } catch {
                    setTasks((prev) =>
                      prev.map((x) => (x.id === t.id ? { ...x, done: false } : x))
                    );
                    showToast('No se pudo marcar');
                  }
                }}
              >
                <View style={styles.taskCheck} />
                {/* Dos líneas: el título de una tarea lo escribe el entrenador
                    y suele ser una frase entera —"Llamar a María para revisar
                    la dieta"—. En una sola línea caben veinticuatro letras en
                    un móvil estrecho, y lo que queda cortado es justo el final,
                    que es donde está lo que hay que hacer. */}
                <Text style={styles.taskTitle} numberOfLines={2}>
                  {t.title}
                </Text>
                {t.flagged ? (
                  <Ionicons name="flag" size={13} color={colors.primary} />
                ) : null}
              </PressableScale>
            ))}
          </Card>
        </FadeIn>
      ) : null}

      {/* Los accesos van DESPUÉS de saber cómo va el grupo: son herramientas,
          y una herramienta antes del diagnóstico se usa a ciegas. */}
      <FadeIn delay={140}>
      <View style={styles.quickRow}>
        <Pressable style={styles.quickBtn} onPress={() => router.push('/(trainer)/agenda')}>
          <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          <Text style={styles.quickLabel}>Calendario y tareas</Text>
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
            {cobros.aReclamar.length > 0 && !paysReminded ? (
              <View style={styles.quickBadge}>
                <Text style={styles.quickBadgeText}>{cobros.aReclamar.length}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.quickLabel}>
            {paysReminded ? 'Pagos avisados' : 'Recordar pagos'}
          </Text>
        </Pressable>
      </View>
      </FadeIn>


      {cobros.hayDatos ? (
        <FadeIn delay={210}>
        <View style={styles.section}>
        <CollapsibleCard
          id="cobros"
          icon="cash-outline"
          title="Cobros del mes"
          /* Con el ojo cerrado, TAMBIÉN aquí. Este resumen se ve con la
             tarjeta plegada, que es como está la mayor parte del tiempo: si se
             escapara, tapar los importes no taparía nada. */
          hint={
            ocultos
              ? frase`${cobros.aReclamar.length} pendiente(s)`
              : `${cobros.ingresoDelMes} € · ${cobros.importePendiente} € pendiente`
          }
        >
          {/*
            UNA CIFRA QUE MANDA, UNA BARRA Y DOS FILAS.

            Aquí había tres cajas iguales —ingresado, pendiente, previsto— cada
            una con su color fuerte y su iconito en la esquina. Tres cifras del
            mismo tamaño no son un resumen: son tres cosas compitiendo, y
            ninguna contesta de un vistazo a lo único que se pregunta un
            entrenador al abrir esto, que es "¿voy bien este mes?".

            Ahora lo cobrado va grande y solo, la barra dice qué parte del mes
            es, y lo pendiente y lo previsto bajan a una fila de dos columnas
            —etiqueta a la izquierda, cifra a la derecha— que es como lo enseña
            cualquier herramienta de contabilidad. Ocupa lo mismo o menos.
          */}
          <View style={styles.cobroCabecera}>
            <Text style={styles.cobroRotulo}>Cobrado este mes</Text>
            <Pressable onPress={alternarOjo} hitSlop={10} style={styles.ojo}>
              <Ionicons
                name={ocultos ? 'eye-off-outline' : 'eye-outline'}
                size={17}
                color={colors.textFaint}
              />
            </Pressable>
          </View>
          <Pressable onPress={() => setIncomeOpen(true)} style={styles.cobroPrincipal} hitSlop={4}>
            {ocultos ? (
              <Text style={styles.cobroCifra}>•••</Text>
            ) : (
              <CountUp value={cobros.ingresoDelMes} suffix=" €" style={styles.cobroCifra} />
            )}
            <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
          </Pressable>

          {reparto.total > 0 ? (
            <>
              {/* Dos segmentos en una sola barra: lo cobrado y lo que falta.
                  El ancho mínimo evita que un euro suelto salga invisible. */}
              <View style={styles.barra}>
                <View
                  style={[
                    styles.barraCobrado,
                    { width: `${Math.max(2, Math.round(reparto.porcentaje * 100))}%` },
                  ]}
                />
              </View>
              <Text style={styles.barraPie}>
                {ocultos
                  ? frase`${Math.round(reparto.porcentaje * 100)}% de lo previsto para el mes`
                  : frase`${Math.round(reparto.porcentaje * 100)}% de ${reparto.total.toLocaleString('es-ES')} € previstos este mes`}
              </Text>
            </>
          ) : null}

          <View style={styles.raya} />

          <Pressable style={styles.cobroFila} onPress={() => setPayListOpen(true)} hitSlop={4}>
            <View style={[styles.punto, { backgroundColor: '#C9902B' }]} />
            <Text style={styles.cobroFilaEtiqueta}>
              Pendiente{cobros.aReclamar.length > 0 ? ` · ${cobros.aReclamar.length}` : ''}
            </Text>
            <Text style={[styles.cobroFilaCifra, { color: '#C9902B' }]}>
              {euros(cobros.importePendiente)}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textFaint} />
          </Pressable>

          {cobros.previsto30 > 0 ? (
            <Pressable style={styles.cobroFila} onPress={() => setUpcomingOpen(true)} hitSlop={4}>
              <View style={[styles.punto, { backgroundColor: colors.textFaint }]} />
              <Text style={styles.cobroFilaEtiqueta}>
                Próximos 30 días · {cobros.renuevanEn30.length}
              </Text>
              <Text style={[styles.cobroFilaCifra, { color: colors.textMuted }]}>
                {euros(cobros.previsto30)}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textFaint} />
            </Pressable>
          ) : null}

          {cobros.proximoCobro ? (
            <Pressable
              onPress={() => router.push(`/(trainer)/clients/${cobros.proximoCobro!.uid}`)}
              style={styles.nextPayRow}
              hitSlop={4}
            >
              <Avatar name={cobros.proximoCobro.name} photoURL={cobros.proximoCobro.photoURL} size={30} />
              <View style={{ flex: 1 }}>
                <Text style={styles.nextPayLabel}>Próximo cobro</Text>
                <Text style={styles.nextPayName} numberOfLines={1}>
                  {cobros.proximoCobro.name}
                  {cobros.proximoCobro.monthlyFeeEur
                    ? ` · ${importeVisible(cobros.proximoCobro.monthlyFeeEur, ocultos)}`
                    : ''}
                </Text>
              </View>
              <Text style={styles.nextPayDate}>
                {diaMes(cobros.proximoCobro.nextPaymentDate!)}
              </Text>
            </Pressable>
          ) : null}
          {cobros.aReclamar.length > 0 ? (
            <Pressable
              onPress={() => setPayListOpen(true)}
              style={styles.dueBanner}
              hitSlop={6}
            >
              <Ionicons name="alert-circle" size={15} color={colors.danger} />
              <Text style={styles.dueText}>
                {cobros.aReclamar.length} pago{cobros.aReclamar.length === 1 ? '' : 's'} pendiente
                {cobros.aReclamar.length === 1 ? '' : 's'}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.danger} />
            </Pressable>
          ) : null}
        </CollapsibleCard>
        </View>
        </FadeIn>
      ) : null}

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

      {/* Lista de alumnos con pago pendiente/vencido (desde la alerta roja). */}
      <Sheet
        visible={payListOpen}
        onClose={() => setPayListOpen(false)}
        titulo={frase`Pagos pendientes (${cobros.aReclamar.length})`}
      >
            {cobros.aReclamar.length === 0 ? (
              <Text style={styles.mutedText}>No hay pagos pendientes.</Text>
            ) : (
              cobros.aReclamar.map((c) => (
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
                          ? ` · vence ${fechaNumerica(c.nextPaymentDate)}`
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
      </Sheet>

      {/* Gestión de ingresos del mes: ver, corregir importe o eliminar un pago. */}
      <Sheet
        visible={incomeOpen}
        onClose={() => {
          setIncomeOpen(false);
          setEditPayId(null);
        }}
        titulo="Ingresos"
      >
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
                {(incomeScope === 'month' ? cobros.ingresoDelMes : cobros.ingresoTotal).toLocaleString('es-ES')}{' '}
                €
              </Text>
            </View>
            <Text style={styles.subtleHint}>
              Ajusta el importe o elimina un pago si hubo un error.
            </Text>

            {/*
              REGISTRAR UN COBRO DE ALGUIEN QUE NO ESTÁ EN LA APP.

              Un entrenador no empieza con la app: empieza con gente que ya le
              paga. Sin esto, sus ingresos de verdad —la mitad, o todos el
              primer mes— no cabían en ninguna parte, y una pantalla de
              ingresos que no cuadra con el banco no se mira dos veces.

              Va aquí y no en la tarjeta del inicio a propósito: la tarjeta es
              para mirar de un vistazo, y esto es una herramienta.
            */}
            {nuevoCobroAbierto ? (
              <View style={{ marginBottom: spacing.md }}>
                <TextField
                  value={nuevoNombre}
                  onChangeText={setNuevoNombre}
                  placeholder="Nombre de quien paga"
                  maxLength={LARGO_DEL_NOMBRE}
                  autoFocus
                />
                <TextField
                  value={nuevoImporte}
                  onChangeText={setNuevoImporte}
                  placeholder="Importe en euros"
                  keyboardType="decimal-pad"
                />
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Button
                    title="Cancelar"
                    variant="secondary"
                    onPress={() => setNuevoCobroAbierto(false)}
                    style={{ flex: 1 }}
                    compacto
                  />
                  <Button
                    title="Registrar"
                    onPress={registrarCobroExterno}
                    loading={guardandoCobro}
                    disabled={!cobroValido(nuevoNombre, importeEscrito(nuevoImporte))}
                    style={{ flex: 1 }}
                    compacto
                  />
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setNuevoCobroAbierto(true)} style={styles.nuevoCobroBtn}>
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text style={styles.nuevoCobroTexto}>Registrar un cobro de fuera de la app</Text>
              </Pressable>
            )}
            {incomeScope === 'month' ? (
              cobros.pagosDelMes.length === 0 ? (
                <Text style={styles.mutedText}>Aún no hay pagos registrados este mes.</Text>
              ) : (
                <ScrollView style={{ maxHeight: 400 }}>
                  {cobros.pagosDelMes.map((p) => renderPayRow(p, true))}
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
                      {/* Borra los cobros de esta persona, no a la persona. El
                          aviso lo dice con esas palabras: alguien que se fue
                          del grupo hace un año sigue ocupando una ficha en una
                          lista que se mira para saber quién paga AHORA. */}
                      <Pressable
                        onPress={() => borrarFichaDeCobros(g.cid, g.name, g.pays.length)}
                        style={styles.fichaBorrar}
                        hitSlop={8}
                      >
                        <Ionicons name="trash-outline" size={17} color={colors.textFaint} />
                      </Pressable>
                    </View>
                    {g.pays.map((p) => renderPayRow(p, false))}
                  </View>
                ))}
              </ScrollView>
            )}
      </Sheet>

      {/* Lista de renovaciones previstas en los próximos 30 días. */}
      <Sheet
        visible={upcomingOpen}
        onClose={() => setUpcomingOpen(false)}
        titulo={frase`Previsto 30 días (${cobros.previsto30} €)`}
      >
            {cobros.renuevanEn30.length === 0 ? (
              <Text style={styles.mutedText}>No hay renovaciones previstas en 30 días.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 420 }}>
                {cobros.renuevanEn30
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
                          {c.nextPaymentDate ? diaMes(c.nextPaymentDate) : ''}
                        </Text>
                      </View>
                      <Text style={styles.payAmount}>{c.monthlyFeeEur} €</Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                    </Pressable>
                  ))}
              </ScrollView>
            )}
      </Sheet>

    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  taskCheck: {
    width: 19,
    height: 19,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  taskTitle: { ...typography.body, color: colors.text, flex: 1 },
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
    marginBottom: spacing.md,
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
  cobroCabecera: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cobroRotulo: {
    ...typography.small,
    color: colors.textFaint,
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  ojo: { padding: 2 },
  cobroPrincipal: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  /*
   * La cifra grande va en BLANCO, no en verde.
   *
   * Estaba en `colors.success`, y el verde de "correcto" aplicado a un importe
   * dice que ese número está bien. No lo está ni lo deja de estar: es lo que se
   * ha cobrado. El color se reserva para lo que sí es un estado —el ámbar de lo
   * pendiente— y así, cuando algo se pone de color, significa algo.
   */
  cobroCifra: { ...typography.h1, color: colors.text, fontFamily: fonts.heading, flex: 1 },
  barra: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  barraCobrado: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  barraPie: { ...typography.small, color: colors.textFaint, fontSize: 12, marginTop: 6 },
  raya: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  cobroFila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 7,
  },
  punto: { width: 7, height: 7, borderRadius: 4 },
  cobroFilaEtiqueta: { ...typography.small, color: colors.textMuted, flex: 1 },
  // Cifras alineadas a la derecha y con cifras de ancho fijo: una columna de
  // importes que baila al cambiar un número se lee como una hoja mal hecha.
  cobroFilaCifra: { ...typography.body, fontFamily: fonts.semiBold, ...tabularNums },
  nuevoCobroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    marginBottom: spacing.md,
  },
  nuevoCobroTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  fichaBorrar: { padding: 4 },
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
