import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../../components/Avatar';
import { FadeIn } from '../../../components/FadeIn';
import { Card } from '../../../components/Card';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorState } from '../../../components/ErrorState';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ListSkeleton } from '../../../components/Skeleton';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { TextField } from '../../../components/TextField';
import { showToast } from '../../../components/Toast';
import { useAuth } from '../../../lib/auth-context';
import { getClientsForTrainer } from '../../../lib/firestore/users';
import { getWorkoutLogsForTrainer } from '../../../lib/firestore/workoutLogs';
import { buildCsv, downloadCsv } from '../../../lib/exportCsv';
import { getCached, setCached } from '../../../lib/screenCache';
import { colors, fonts, radius, spacing, typography } from '../../../lib/theme';
import {
  CLIENT_STATUS_LABEL,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_TONE,
  type PaymentStatus,
  type UserProfile,
} from '../../../lib/types';

const PAY_TONE_COLOR: Record<'good' | 'warn' | 'bad' | 'muted', string> = {
  good: '#2E7D5B',
  warn: '#C9902B',
  bad: colors.danger,
  muted: colors.textFaint,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Última actividad como texto + tono: hoy/ayer verde, <7d ámbar, resto rojo. */
function activityInfo(last?: number): { label: string; color: string } {
  if (!last) return { label: 'Sin entrenos aún', color: colors.textFaint };
  const days = Math.floor((Date.now() - last) / DAY_MS);
  if (days <= 0) return { label: 'Entrenó hoy', color: '#2E7D5B' };
  if (days === 1) return { label: 'Entrenó ayer', color: '#2E7D5B' };
  if (days < 7) return { label: `Entrenó hace ${days} días`, color: '#C9902B' };
  return { label: `Sin entrenar ${days} días`, color: colors.danger };
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

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) {
    return (
      <ScreenContainer>
        <Text style={styles.title}>Tus clientes</Text>
        <Text style={styles.subtitle}>Cargando tu grupo...</Text>
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
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Tus clientes</Text>
          <Text style={styles.subtitle}>{clients.length} cliente(s) activos</Text>
        </View>
        {clients.length > 0 && Platform.OS === 'web' ? (
          <Pressable onPress={handleExportCsv} style={styles.exportBtn} hitSlop={6}>
            <Ionicons name="download-outline" size={15} color={colors.primary} />
            <Text style={styles.exportText}>Exportar</Text>
          </Pressable>
        ) : null}
      </View>

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
        <Card style={styles.inviteCard}>
          <Text style={styles.inviteTitle}>Aún no tienes clientes</Text>
          <Text style={styles.inviteText}>
            Comparte tu código de invitación desde la pestaña de Perfil para que tus clientes
            se registren y aparezcan aquí automáticamente.
          </Text>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState icon="search-outline" title="Sin resultados" subtitle="Prueba con otro nombre o cambia el filtro." />
      ) : (
        filtered.map((client, index) => {
          const activity = activityInfo(lastTrained[client.uid]);
          return (
          <FadeIn key={client.uid} delay={Math.min(index * 40, 280)}>
          <Pressable onPress={() => router.push(`/(trainer)/clients/${client.uid}`)}>
            <Card style={styles.clientCard}>
              <Avatar name={client.name} photoURL={client.photoURL} size={44} />
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
              </View>
              {client.status && client.status !== 'active' ? (
                <View style={styles.statusDot}>
                  <Text style={styles.statusDotText}>{CLIENT_STATUS_LABEL[client.status]}</Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
            </Card>
          </Pressable>
          </FadeIn>
          );
        })
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
    marginBottom: spacing.sm,
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
