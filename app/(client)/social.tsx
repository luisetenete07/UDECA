import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Redirect, useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ScreenContainer } from '../../components/ScreenContainer';
import { useAuth } from '../../lib/auth-context';
import { getActiveChallenge } from '../../lib/firestore/challenges';
import {
  compareLeaderboard,
  subscribeSocialLeaderboard,
  syncMySocialStats,
} from '../../lib/firestore/social';
import { getWorkoutLogsForClient } from '../../lib/firestore/workoutLogs';
import { monthKeyOf, startOfWeek } from '../../lib/stats';
import { isOnline } from '../../lib/presence';
import { fonts, colors, radius, spacing, typography } from '../../lib/theme';
import type { Challenge, SocialStats } from '../../lib/types';

const MEDALS = ['#D4AF37', '#B8B8B8', '#B87333']; // oro, plata, bronce

export default function SocialScreen() {
  const { profile } = useAuth();
  const [members, setMembers] = useState<SocialStats[]>([]);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Nuestras métricas recién calculadas. Se superponen sobre lo que llega del
  // ranking para que nuestra fila nunca salga desactualizada por la latencia.
  const mineRef = useRef<SocialStats | null>(null);

  const myUid = profile?.uid;
  const withMine = useCallback(
    (rows: SocialStats[]) => {
      const mine = mineRef.current;
      if (!mine || !myUid) return rows;
      return rows.map((m) => (m.uid === myUid ? { ...m, ...mine } : m)).sort(compareLeaderboard);
    },
    [myUid]
  );

  const load = useCallback(async () => {
    if (!profile?.trainerId) {
      setLoading(false);
      return;
    }
    // Nos aseguramos de que nuestras propias métricas estén al día; la lista en
    // sí llega sola por la suscripción en vivo.
    const myLogs = await getWorkoutLogsForClient(profile.uid);
    mineRef.current = await syncMySocialStats(profile, myLogs);
    setMembers((prev) => withMine(prev));
    setChallenge(await getActiveChallenge(profile.trainerId));
    setRefreshing(false);
  }, [profile, withMine]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Ranking en vivo: cualquier cambio en el grupo (una racha, un entreno nuevo,
  // un alumno que acaba de entrar) se refleja sin salir ni refrescar.
  //
  // La escucha vive solo mientras ESTA pantalla está en primer plano. Es
  // importante: los alumnos refrescan su presencia cada pocos minutos, así que
  // un listener abierto en segundo plano recibiría los latidos de todo el grupo
  // sin que nadie los esté mirando, multiplicando las lecturas de Firestore.
  useFocusEffect(
    useCallback(() => {
      const trainerId = profile?.trainerId;
      if (!trainerId) return;
      return subscribeSocialLeaderboard(
        trainerId,
        (rows) => {
          setMembers(withMine(rows));
          setLoading(false);
        },
        () => setLoading(false)
      );
    }, [profile?.trainerId, withMine])
  );

  // El atleta individual no forma parte de ningún grupo: fuera de aquí.
  if (profile?.role === 'athlete') return <Redirect href="/(client)/dashboard" />;

  if (loading) return <LoadingScreen />;

  if (!profile?.trainerId) {
    return (
      <ScreenContainer>
        <Text style={styles.title}>Social</Text>
        <EmptyState
          icon="people-outline"
          title="Sin comunidad todavía"
          subtitle="Vincúlate a tu entrenador con un código de invitación para ver a tus compañeros."
        />
      </ScreenContainer>
    );
  }

  const topStreak = members.reduce((m, s) => Math.max(m, s.streakThisMonth ?? s.currentStreak), 0);
  const totalSessions = members.reduce((sum, s) => sum + s.sessionsThisWeek, 0);

  // Podio del cambio de mes: los primeros 5 días del mes mostramos, de forma
  // discreta, el top 3 por mejor racha del MES ANTERIOR. Solo cuentan miembros
  // cuyas métricas se sincronizaron ya este mes (monthKey al día).
  const now = new Date();
  const showPodium = now.getDate() <= 5;
  const thisMonthKey = monthKeyOf(Date.now());
  const lastMonthName = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString(
    'es-ES',
    { month: 'long' }
  );
  const podium = showPodium
    ? members
        .filter((m) => m.monthKey === thisMonthKey && (m.lastMonthStreak ?? 0) > 0)
        .sort((a, b) => (b.lastMonthStreak ?? 0) - (a.lastMonthStreak ?? 0))
        .slice(0, 3)
    : [];

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <ScreenContainer refreshing={refreshing} onRefresh={onRefresh}>
      <Text style={styles.title}>Comunidad UDECA</Text>
      <Text style={styles.subtitle}>El ranking de constancia de tu coaching</Text>

      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <Ionicons name="people" size={18} color={colors.primary} />
          <Text style={styles.summaryValue}>{members.length}</Text>
          <Text style={styles.summaryLabel}>Miembros</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Ionicons name="flame" size={18} color={colors.primary} />
          <Text style={styles.summaryValue}>{topStreak}</Text>
          <Text style={styles.summaryLabel}>Mejor racha (mes)</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Ionicons name="checkmark-done" size={18} color={colors.primary} />
          <Text style={styles.summaryValue}>{totalSessions}</Text>
          <Text style={styles.summaryLabel}>Entrenos (semana)</Text>
        </Card>
      </View>

      {podium.length > 0 ? (
        <View style={styles.podium}>
          <Ionicons name="trophy" size={14} color={colors.primary} />
          <Text style={styles.podiumTitle}>Mejor racha de {lastMonthName}:</Text>
          {podium.map((m, i) => (
            <Text key={m.uid} style={styles.podiumItem}>
              <Text style={{ color: MEDALS[i], fontFamily: fonts.heading }}>{i + 1}º</Text>{' '}
              {m.name.split(' ')[0]} ({m.lastMonthStreak})
              {i < podium.length - 1 ? '  ·' : ''}
            </Text>
          ))}
        </View>
      ) : null}

      {challenge ? (
        <Card accent style={styles.challengeCard}>
          <View style={styles.challengeHeader}>
            <Ionicons name="trophy" size={18} color={colors.primary} />
            <Text style={styles.challengeTitle}>{challenge.title}</Text>
          </View>
          <Text style={styles.challengeMeta}>
            Reto del grupo · hasta el{' '}
            {new Date(challenge.endDate).toLocaleDateString('es-ES', {
              day: '2-digit',
              month: 'long',
            })}
          </Text>
          {[...members]
            .filter((m) => (m.challengeSessions ?? 0) > 0)
            .sort((a, b) => (b.challengeSessions ?? 0) - (a.challengeSessions ?? 0))
            .slice(0, 5)
            .map((m, i) => (
              <View key={m.uid} style={styles.challengeRow}>
                <Text style={styles.challengeRank}>{i + 1}</Text>
                <Avatar name={m.name} photoURL={m.photoURL} size={28} />
                <Text style={styles.challengeName}>
                  {m.name}
                  {m.uid === profile.uid ? ' · Tú' : ''}
                </Text>
                <Text style={styles.challengeCount}>{m.challengeSessions} sesiones</Text>
              </View>
            ))}
          {members.every((m) => !(m.challengeSessions ?? 0)) ? (
            <Text style={styles.challengeMeta}>
              Nadie ha puntuado todavía. Cada sesión registrada cuenta: sé el primero.
            </Text>
          ) : null}
        </Card>
      ) : null}

      {(() => {
        // Tablón de récords: PRs del grupo conseguidos esta semana. Cuenta la
        // semana natural (lunes 00:00 → domingo 23:59), así el tablón se
        // renueva al terminar el domingo.
        const weekStart = startOfWeek(Date.now());
        const weekPRs = members
          .filter((m) => m.lastPR && m.lastPR.date >= weekStart)
          .sort((a, b) => (b.lastPR?.date ?? 0) - (a.lastPR?.date ?? 0));
        if (weekPRs.length === 0) return null;
        return (
          <>
            <Text style={styles.sectionTitle}>Récords de la semana</Text>
            <Card accent style={{ marginBottom: spacing.lg }}>
              {weekPRs.map((m) => (
                <View key={m.uid} style={styles.prBoardRow}>
                  <Avatar name={m.name} photoURL={m.photoURL} size={34} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{m.name.split(' ')[0]}</Text>
                    <Text style={styles.prBoardDetail} numberOfLines={1}>
                      {m.lastPR?.exerciseName}
                    </Text>
                  </View>
                  <Text style={styles.prBoardValue}>{m.lastPR?.label}</Text>
                </View>
              ))}
            </Card>
          </>
        );
      })()}

      <Text style={styles.sectionTitle}>Ranking de racha · este mes</Text>

      {members.length === 0 ? (
        <EmptyState
          icon="trophy-outline"
          title="Aún no hay actividad"
          subtitle="Cuando tú y tus compañeros registréis entrenamientos, apareceréis aquí."
        />
      ) : (
        members.map((member, index) => {
          const isMe = member.uid === profile.uid;
          const medalColor = index < 3 ? MEDALS[index] : undefined;
          return (
            <Card key={member.uid} style={[styles.row, isMe && styles.rowMe]}>
              <View style={styles.rankWrap}>
                {medalColor ? (
                  <Ionicons name="medal" size={22} color={medalColor} />
                ) : (
                  <Text style={styles.rankNumber}>{index + 1}</Text>
                )}
              </View>
              <Avatar name={member.name} photoURL={member.photoURL} size={44} />
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>
                    {member.name}
                    {isMe ? <Text style={styles.youTag}>  · Tú</Text> : null}
                  </Text>
                  {isOnline(member.lastSeen) ? <View style={styles.onlineDot} /> : null}
                </View>
                <Text style={styles.meta}>
                  {member.workoutsThisMonth ?? 0} entrenos este mes · {member.sessionsThisWeek} esta
                  semana
                </Text>
              </View>
              <View style={styles.streakWrap}>
                <View style={styles.streakBadge}>
                  <Ionicons name="flame" size={14} color={colors.primary} />
                  <Text style={styles.streakValue}>
                    {member.streakThisMonth ?? member.currentStreak}
                  </Text>
                </View>
                <Text style={styles.streakLabel}>días</Text>
              </View>
            </Card>
          );
        })
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  prBoardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  prBoardDetail: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  prBoardValue: { ...typography.body, color: colors.primaryBright, fontFamily: fonts.heading },
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  podium: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.lg,
  },
  podiumTitle: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  podiumItem: { ...typography.small, color: colors.text, fontSize: 12 },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  summaryCard: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  summaryValue: { ...typography.h2, color: colors.text, marginTop: spacing.xs },
  summaryLabel: { ...typography.small, color: colors.textMuted, textAlign: 'center', marginTop: 2 },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  rowMe: { borderColor: colors.primary },
  rankWrap: { width: 26, alignItems: 'center' },
  rankNumber: { ...typography.h3, color: colors.textFaint },
  name: { ...typography.h3, color: colors.text },
  youTag: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  meta: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  streakWrap: { alignItems: 'center' },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  streakValue: { ...typography.body, color: colors.primary, fontFamily: fonts.heading },
  streakLabel: { ...typography.small, color: colors.textFaint, marginTop: 2, fontSize: 11 },
  challengeCard: { marginBottom: spacing.lg },
  challengeHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  challengeTitle: { ...typography.h3, color: colors.primaryBright, flex: 1 },
  challengeMeta: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs },
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  challengeRank: { ...typography.h3, color: colors.textFaint, width: 18 },
  challengeName: { ...typography.body, color: colors.text, flex: 1 },
  challengeCount: { ...typography.body, color: colors.primary, fontFamily: fonts.semiBold },
});
