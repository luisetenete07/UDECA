import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../../components/Avatar';
import { FadeIn } from '../../../components/FadeIn';
import { Grid } from '../../../components/Grid';
import { CardButton } from '../../../components/CardButton';
import { Card } from '../../../components/Card';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorState } from '../../../components/ErrorState';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ListSkeleton } from '../../../components/Skeleton';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { TextField } from '../../../components/TextField';
import { showToast } from '../../../components/Toast';
import { useAuth } from '../../../lib/auth-context';
import { syncClientCountOnServer } from '../../../lib/join';
import { getClientsForTrainer, subscribeClientsForTrainer } from '../../../lib/firestore/users';
import { getWorkoutLogsForTrainer } from '../../../lib/firestore/workoutLogs';
import { getActiveRoutineForClient } from '../../../lib/firestore/routines';
import { buildCsv, downloadCsv } from '../../../lib/exportCsv';
import { getCached, setCached } from '../../../lib/screenCache';
import { colors, fonts, radius, spacing, typography } from '../../../lib/theme';
import {
  CLIENT_STATUS_LABEL,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  todayWeekday,
  type PaymentStatus,
  type Routine,
  type UserProfile,
  type WorkoutLog,
} from '../../../lib/types';

const PAY_TONE_COLOR: Record<'good' | 'warn' | 'bad' | 'muted', string> = {
  good: colors.success,
  warn: '#C9902B',
  bad: colors.danger,
  muted: colors.textFaint,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Medianoche local del timestamp (para contar por días de calendario). */
function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Última actividad como texto + tono: hoy/ayer verde, <7d ámbar, resto rojo.
 * Se cuenta por DÍAS DE CALENDARIO (no por periodos de 24 h), así "hoy" y
 * "ayer" cuadran con el día real aunque hayan pasado más o menos de 24 horas.
 */
function activityInfo(last?: number): { label: string; color: string } {
  if (!last) return { label: 'Sin entrenos', color: colors.textFaint };
  const days = Math.round((startOfDay(Date.now()) - startOfDay(last)) / DAY_MS);
  if (days <= 0) return { label: 'Hoy', color: colors.success };
  if (days === 1) return { label: 'Ayer', color: colors.success };
  if (days < 7) return { label: `Hace ${days} días`, color: '#C9902B' };
  return { label: `${days} días parado`, color: colors.danger };
}

/** Medianoche local del lunes de la semana que contiene ts (lunes=inicio). */
function mondayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const wd = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - wd);
  return d.getTime();
}

/**
 * Entrenamientos que el alumno se ha SALTADO esta semana: días de entreno
 * (no descanso) con día de la semana asignado que ya han pasado (antes de hoy)
 * y en los que no registró ninguna sesión. Solo aplica a rutinas semanales
 * (en ciclo/sensaciones no hay día fijo, así que no se puede "saltar" uno).
 */
function skippedThisWeek(routine: Routine | null | undefined, trainedDays: Set<number>): number {
  if (!routine || (routine.schedule ?? 'weekly') !== 'weekly') return 0;
  const monday = mondayStart(Date.now());
  const todayWd = todayWeekday();
  let skipped = 0;
  for (const day of routine.days) {
    if (day.isRest || day.optionalRest || day.weekday == null) continue;
    if (day.weekday >= todayWd) continue; // hoy o futuro: aún no cuenta
    const d = new Date(monday);
    d.setDate(d.getDate() + day.weekday);
    d.setHours(0, 0, 0, 0);
    if (!trainedDays.has(d.getTime())) skipped++;
  }
  return skipped;
}

export default function ClientsScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  // Pinta al instante lo último conocido (caché de sesión) y refresca detrás.
  const cacheKey = `clients-${profile?.uid ?? ''}`;
  const [clients, setClients] = useState<UserProfile[]>(
    () => getCached<UserProfile[]>(cacheKey) ?? []
  );
  const [lastTrained, setLastTrained] = useState<Record<string, number>>(
    () => getCached<Record<string, number>>(`${cacheKey}-last`) ?? {}
  );
  const [skipped, setSkipped] = useState<Record<string, number>>(
    () => getCached<Record<string, number>>(`${cacheKey}-skip`) ?? {}
  );
  const [loading, setLoading] = useState(() => getCached(cacheKey) === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [payFilter, setPayFilter] = useState<PaymentStatus | 'all'>('all');
  // Orden: alfabético o por actividad (los que llevan más tiempo sin entrenar
  // primero, para actuar rápido con grupos grandes).
  const [sortMode, setSortMode] = useState<'name' | 'activity'>('name');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      const [data, logs] = await Promise.all([
        getClientsForTrainer(profile.uid),
        getWorkoutLogsForTrainer(profile.uid),
      ]);
      // Última sesión de cada alumno, para ver de un vistazo quién entrena.
      const last: Record<string, number> = {};
      for (const log of logs) {
        if (!last[log.clientId] || log.date > last[log.clientId]) last[log.clientId] = log.date;
      }
      setClients(data);
      setLastTrained(last);
      setCached(cacheKey, data);
      setCached(`${cacheKey}-last`, last);
      // Entrenamientos saltados esta semana: requiere la rutina activa de cada
      // alumno + los días que entrenó esta semana. Se calcula en segundo plano
      // para no frenar el pintado de la lista.
      const monday = mondayStart(Date.now());
      const trainedByClient: Record<string, Set<number>> = {};
      for (const log of logs as WorkoutLog[]) {
        if (log.date < monday) continue;
        (trainedByClient[log.clientId] ??= new Set()).add(startOfDay(log.date));
      }
      Promise.all(
        data.map((c) =>
          getActiveRoutineForClient(c.uid, profile.uid).catch(() => null)
        )
      )
        .then((routines) => {
          const skip: Record<string, number> = {};
          data.forEach((c, i) => {
            const n = skippedThisWeek(routines[i], trainedByClient[c.uid] ?? new Set());
            if (n > 0) skip[c.uid] = n;
          });
          setSkipped(skip);
          setCached(`${cacheKey}-skip`, skip);
        })
        .catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, cacheKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Altas y bajas del grupo en vivo: un alumno recién aceptado aparece en la
  // lista sin refrescar ni volver atrás. El resto de datos derivados (últimas
  // sesiones, entrenos saltados) los sigue calculando `load`. Solo escucha
  // mientras la lista está delante.
  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      return subscribeClientsForTrainer(
        profile.uid,
        (data) => {
          setClients(data);
          setCached(cacheKey, data);
          // El recuento que decide el acceso lo escribe el SERVIDOR, no la
          // app: aquí solo se le pide que lo recalcule cuando el número visible
          // no cuadra con el guardado (p. ej. tras quitar a alguien del grupo).
          if (data.length !== profile.clientCount) void syncClientCountOnServer();
        },
        // Si la escucha se cae (permisos, red), hay que enterarse: en silencio
        // parecería que "no llegan alumnos nuevos" sin motivo aparente.
        (e) => showToast(`Lista en vivo no disponible: ${e.message}`)
      );
    }, [profile, cacheKey])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) {
    return (
      <ScreenContainer>
        <ScreenHeader title="Tus clientes" subtitle="Cargando tu grupo..." />
        <ListSkeleton rows={6} />
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <Text style={styles.title}>Tus clientes</Text>
        <ErrorState
          title="No se pudo cargar la lista"
          subtitle={error}
          onRetry={() => {
            setLoading(true);
            load();
          }}
        />
      </ScreenContainer>
    );
  }

  const filtered = clients
    .filter(
      (c) =>
        (c.name ?? '').toLowerCase().includes(search.toLowerCase().trim()) &&
        (payFilter === 'all' || c.paymentStatus === payFilter)
    )
    .sort((a, b) =>
      sortMode === 'activity'
        ? (lastTrained[a.uid] ?? 0) - (lastTrained[b.uid] ?? 0)
        : (a.name ?? '').localeCompare(b.name ?? '')
    );
  // Cuántos alumnos hay en cada estado de pago (para las pastillas de filtro).
  const payCounts = PAYMENT_STATUSES.reduce(
    (acc, p) => ({ ...acc, [p]: clients.filter((c) => c.paymentStatus === p).length }),
    {} as Record<PaymentStatus, number>
  );

  const handleExportCsv = () => {
    const fmt = (ts?: number) => (ts ? new Date(ts).toLocaleDateString('es-ES') : '');
    const rows = clients.map((c) => [
      c.name,
      c.email,
      c.paymentStatus ? PAYMENT_STATUS_LABEL[c.paymentStatus] : '',
      c.monthlyFeeEur ?? '',
      fmt(c.nextPaymentDate),
      fmt(lastTrained[c.uid]),
      c.goal ?? '',
    ]);
    const csv = buildCsv(
      ['Nombre', 'Email', 'Pago', 'Cuota (€)', 'Próximo pago', 'Última sesión', 'Objetivo'],
      rows
    );
    const stamp = new Date().toISOString().slice(0, 10);
    if (!downloadCsv(`udeca-clientes-${stamp}.csv`, csv)) {
      showToast('La exportación solo está disponible en la versión web');
    }
  };

  return (
    <ScreenContainer refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader
        title="Tus clientes"
        subtitle={`${clients.length} alumno${clients.length === 1 ? '' : 's'} activo${
          clients.length === 1 ? '' : 's'
        }`}
        actions={
          clients.length > 0 && Platform.OS === 'web' ? (
            <Pressable onPress={handleExportCsv} style={styles.exportBtn} hitSlop={6}>
              <Ionicons name="download-outline" size={15} color={colors.primary} />
              <Text style={styles.exportText}>Exportar</Text>
            </Pressable>
          ) : null
        }
      />

      <Pressable
        onPress={() => router.push('/(trainer)/clients/meal-books')}
        style={styles.navEntry}
      >
        <View style={styles.navEntryIcon}>
          <Ionicons name="book-outline" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.navEntryTitle}>Libretas de comida</Text>
          <Text style={styles.navEntrySub}>Recetas y platos por foto para todos tus alumnos</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </Pressable>

      {clients.length > 0 ? (
        <TextField
          placeholder="Buscar cliente..."
          value={search}
          onChangeText={setSearch}
          style={styles.search}
        />
      ) : null}

      {clients.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.sm }}
        >
          <Pressable
            onPress={() => setSortMode((m) => (m === 'name' ? 'activity' : 'name'))}
            style={[styles.filterChip, sortMode === 'activity' && styles.filterChipActive]}
          >
            <Ionicons
              name="swap-vertical"
              size={13}
              color={sortMode === 'activity' ? colors.onPrimary : colors.textMuted}
            />
            <Text
              style={[styles.filterText, sortMode === 'activity' && styles.filterTextActive]}
            >
              {sortMode === 'activity' ? 'Menos activos primero' : 'A-Z'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setPayFilter('all')}
            style={[styles.filterChip, payFilter === 'all' && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, payFilter === 'all' && styles.filterTextActive]}>
              Todos ({clients.length})
            </Text>
          </Pressable>
          {PAYMENT_STATUSES.map((p) => (
            <Pressable
              key={p}
              onPress={() => setPayFilter((cur) => (cur === p ? 'all' : p))}
              style={[styles.filterChip, payFilter === p && styles.filterChipActive]}
            >
              <View style={[styles.dot, { backgroundColor: PAY_TONE_COLOR[PAYMENT_STATUS_TONE[p]] }]} />
              <Text style={[styles.filterText, payFilter === p && styles.filterTextActive]}>
                {PAYMENT_STATUS_LABEL[p]} ({payCounts[p]})
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {clients.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="Aún no tienes clientes"
          subtitle="Comparte tu código de invitación para que tus alumnos se registren y aparezcan aquí automáticamente."
          actionLabel="Ver mi código"
          onAction={() => router.push('/(trainer)/profile')}
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon="search-outline" title="Sin resultados" subtitle="Prueba con otro nombre o cambia el filtro." />
      ) : (
        <Grid>
        {filtered.map((client, index) => {
          const activity = activityInfo(lastTrained[client.uid]);
          return (
          <FadeIn key={client.uid} delay={Math.min(index * 40, 280)}>
          <CardButton
            onPress={() => router.push(`/(trainer)/clients/${client.uid}`)}
            style={styles.clientCard}
          >
              {/* El aro dice cuándo entrenó sin que haya que leer nada: es el
                  mismo lenguaje que las caras del panel, para que no haya que
                  aprender dos códigos distintos en la misma app. */}
              <View style={[styles.aro, { borderColor: activity.color }]}>
                <Avatar name={client.name} photoURL={client.photoURL} size={40} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.clientName}>{client.name}</Text>
                <Text style={styles.clientGoal}>{client.goal || 'Sin objetivo definido'}</Text>
                <View style={styles.payBadgeRow}>
                  <View style={[styles.dot, { backgroundColor: activity.color }]} />
                  <Text style={[styles.payBadgeText, { color: activity.color }]}>
                    {activity.label}
                  </Text>
                  {client.paymentStatus ? (
                    <>
                      <Text style={styles.badgeSep}>·</Text>
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: PAY_TONE_COLOR[PAYMENT_STATUS_TONE[client.paymentStatus]] },
                        ]}
                      />
                      <Text style={styles.payBadgeText}>
                        {PAYMENT_STATUS_LABEL[client.paymentStatus]}
                      </Text>
                    </>
                  ) : null}
                </View>
                {skipped[client.uid] ? (
                  <View style={styles.skipRow}>
                    <Ionicons name="close-circle" size={13} color={colors.danger} />
                    <Text style={styles.skipText}>
                      Se saltó {skipped[client.uid]} entrenamiento
                      {skipped[client.uid] === 1 ? '' : 's'}
                    </Text>
                  </View>
                ) : null}
              </View>
              {client.status && client.status !== 'active' ? (
                <View style={styles.statusDot}>
                  <Text style={styles.statusDotText}>{CLIENT_STATUS_LABEL[client.status]}</Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
          </CardButton>
          </FadeIn>
          );
        })}
        </Grid>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.lg },
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    marginTop: spacing.xs,
  },
  exportText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold, fontSize: 12 },
  navEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.md,
  },
  navEntryIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navEntryTitle: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  navEntrySub: { ...typography.small, color: colors.textFaint, marginTop: 1 },
  search: { marginBottom: spacing.sm },
  filterRow: { marginBottom: spacing.sm },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold, fontSize: 12 },
  filterTextActive: { color: colors.onPrimary },
  dot: { width: 8, height: 8, borderRadius: 4 },
  payBadgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 4 },
  payBadgeText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.medium, fontSize: 11 },
  badgeSep: { color: colors.textFaint, fontSize: 11 },
  skipRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  skipText: { ...typography.small, color: colors.danger, fontFamily: fonts.semiBold, fontSize: 11 },
  inviteCard: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  inviteTitle: { ...typography.h3, color: colors.text },
  inviteText: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // La separación entre fichas la pone la rejilla, no la tarjeta.
    flex: 1,
  },
  aro: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientName: { ...typography.h3, color: colors.text },
  clientGoal: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  statusDot: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.dangerMuted,
  },
  statusDotText: { ...typography.small, color: colors.warning, fontFamily: fonts.semiBold, fontSize: 11 },
});
