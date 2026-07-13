import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ScreenContainer } from '../../components/ScreenContainer';
import { useAuth } from '../../lib/auth-context';
import { getActiveChallenge } from '../../lib/firestore/challenges';
import { getSocialLeaderboard, syncMySocialStats } from '../../lib/firestore/social';
import { getWorkoutLogsForClient } from '../../lib/firestore/workoutLogs';
import { fonts, colors, radius, spacing, typography } from '../../lib/theme';
import type { Challenge, SocialStats } from '../../lib/types';

const MEDALS = ['#D4AF37', '#B8B8B8', '#B87333']; // oro, plata, bronce

export default function SocialScreen() {
  const { profile } = useAuth();
  const [members, setMembers] = useState<SocialStats[]>([]);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.trainerId) {
      setLoading(false);
      return;
    }
    // Nos aseguramos de que nuestras propias métricas estén al día antes de leer.
    const myLogs = await getWorkoutLogsForClient(profile.uid);
    await syncMySocialStats(profile, myLogs);
    const [data, challengeData] = await Promise.all([
      getSocialLeaderboard(profile.trainerId),
      getActiveChallenge(profile.trainerId),
    ]);
    setMembers(data);
    setChallenge(challengeData);
    setLoading(false);
    setRefreshing(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) return <LoadingScreen />;

  if (!profile?.trainerId) {
    return (
      <ScreenContainer>
        <Text style={styles.title}>Social</Text>
        <EmptyState
          title="Sin comunidad todavía"
          subtitle="Vincúlate a tu entrenador con un código de invitación para ver a tus compañeros."
        />
      </ScreenContainer>
    );
  }

  const topStreak = members.reduce((m, s) => Math.max(m, s.currentStreak), 0);
  const totalSessions = members.reduce((sum, s) => sum + s.sessionsThisWeek, 0);

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
          <Text style={styles.summaryLabel}>Mejor racha</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Ionicons name="checkmark-done" size={18} color={colors.primary} />
          <Text style={styles.summaryValue}>{totalSessions}</Text>
          <Text style={styles.summaryLabel}>Entrenos (semana)</Text>
        </Card>
      </View>

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
        // Tablón de récords: PRs del grupo conseguidos esta semana.
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const weekPRs = members
          .filter((m) => m.lastPR && m.lastPR.date >= weekAgo)
          .sort((a, b) => (b.lastPR?.date ?? 0) - (a.lastPR?.date ?? 0));
        if (weekPRs.length === 0) return null;
        return (
          <>
            <Text style={styles.sectionTitle}>Récords de la semana 🏆</Text>
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

      <Text style={styles.sectionTitle}>Ranking de racha</Text>

      {members.length === 0 ? (
        <EmptyState
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
                <Text style={styles.name}>
                  {member.name}
                  {isMe ? <Text style={styles.youTag}>  · Tú</Text> : null}
                </Text>
                <Text style={styles.meta}>
                  {member.totalWorkouts} entrenos · {member.sessionsThisWeek} esta semana
                </Text>
              </View>
              <View style={styles.streakWrap}>
                <View style={styles.streakBadge}>
                  <Ionicons name="flame" size={14} color={colors.primary} />
                  <Text style={styles.streakValue}>{member.currentStreak}</Text>
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
