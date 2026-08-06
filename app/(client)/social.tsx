import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Redirect, useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { Podium } from '../../components/Podium';
import { Card } from '../../components/Card';
import { showToast } from '../../components/Toast';
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
import { fonts, colors, radius, spacing, tabularNums, typography } from '../../lib/theme';
import type { Challenge, SocialStats } from '../../lib/types';

/**
 * El puesto se distingue por INTENSIDAD, no por color. Oro, plata y bronce
 * eran los únicos tres colores saturados de toda la app y abarataban la
 * pantalla entera; aquí el primero brilla, el segundo se apaga y el tercero
 * casi se apaga del todo, que es la misma información sin romper la paleta.
 */
const PUESTOS = [colors.primaryBright, colors.textMuted, colors.textFaint];

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
        (e) => {
          setLoading(false);
          showToast(`Comunidad en vivo no disponible: ${e.message}`);
        }
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
  /**
   * Los tres del mes pasado.
   *
   * Solo entran quienes ENTRENARON (racha > 0) y tienen la ficha al día: la
   * racha del mes anterior se recalcula al abrir la app, así que la de alguien
   * que lleva meses sin entrar sería de otro mes distinto.
   *
   * Los desempates importan cuando dos hacen los mismos días: primero quien
   * más entrenó, y si sigue el empate, por nombre, que al menos es estable y
   * no cambia de orden en cada recarga.
   */
  const podium = showPodium
    ? members
        .filter((m) => m.monthKey === thisMonthKey && (m.lastMonthStreak ?? 0) > 0)
        .sort(
          (a, b) =>
            (b.lastMonthStreak ?? 0) - (a.lastMonthStreak ?? 0) ||
            (b.totalWorkouts ?? 0) - (a.totalWorkouts ?? 0) ||
            (a.name ?? '').localeCompare(b.name ?? '')
        )
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

      {/* Tres cifras en una fila, con rótulos de una palabra. "Mejor racha
          (mes)" se partía en tres líneas y hacía la tarjeta el doble de alta
          para decir lo mismo. */}
      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <Ionicons name="people" size={16} color={colors.primary} />
          <Text style={styles.summaryValue}>{members.length}</Text>
          <Text style={styles.summaryLabel} numberOfLines={1}>
            Miembros
          </Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Ionicons name="flame" size={16} color={colors.primary} />
          <Text style={styles.summaryValue}>{topStreak}</Text>
          <Text style={styles.summaryLabel} numberOfLines={1}>
            Racha
          </Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Ionicons name="checkmark-done" size={16} color={colors.primary} />
          <Text style={styles.summaryValue}>{totalSessions}</Text>
          <Text style={styles.summaryLabel} numberOfLines={1}>
            Semana
          </Text>
        </Card>
      </View>

      {podium.length > 0 ? (
        <View style={styles.podium}>
          <View style={styles.podiumHeader}>
            <Ionicons name="trophy" size={15} color={colors.primary} />
            <Text style={styles.podiumTitle}>Mejor racha de {lastMonthName}</Text>
          </View>
          {/* Las tres plazas, siempre. Cuando falta alguien se dice por qué en
              vez de enseñar un podio de dos y dejar la duda. */}
          {[0, 1, 2].map((i) => {
            const m = podium[i];
            return (
              <View key={i} style={styles.podiumRow}>
                <Text style={[styles.podiumPos, { color: PUESTOS[i] }]}>{i + 1}º</Text>
                <Text
                  style={[styles.podiumName, !m && styles.podiumVacio]}
                  numberOfLines={1}
                >
                  {m ? m.name.split(' ')[0] : 'Plaza libre'}
                </Text>
                <Text style={[styles.podiumDias, !m && styles.podiumVacio]}>
                  {m
                    ? `${m.lastMonthStreak} ${m.lastMonthStreak === 1 ? 'día' : 'días'}`
                    : '—'}
                </Text>
              </View>
            );
          })}
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
        // Tablón de récords. Se destacan los de la semana natural (lunes 00:00
        // → domingo 23:59), pero si aún no hay ninguno —un lunes por la mañana
        // no lo habrá— se muestran los últimos conseguidos en vez de dejar el
        // tablón vacío: el mérito no desaparece al cambiar de semana.
        const weekStart = startOfWeek(Date.now());
        const withPR = members
          .filter((m) => m.lastPR)
          .sort((a, b) => (b.lastPR?.date ?? 0) - (a.lastPR?.date ?? 0));
        if (withPR.length === 0) return null;
        const weekPRs = withPR.filter((m) => (m.lastPR?.date ?? 0) >= weekStart);
        const thisWeek = weekPRs.length > 0;
        const shown = thisWeek ? weekPRs : withPR.slice(0, 5);
        return (
          <>
            <Text style={styles.sectionTitle}>
              {thisWeek ? 'Récords de la semana' : 'Últimos récords'}
            </Text>
            <Card accent style={{ marginBottom: spacing.lg }}>
              {shown.map((m) => (
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

      {/* Los tres primeros, por tamaño. Una clasificación se lee entera en el
          primer segundo o no se lee, y en una lista de tarjetas iguales el
          primero hay que buscarlo. */}
      <Podium
        yo={profile.uid}
        puestos={members.slice(0, 3).map((m) => ({
          uid: m.uid,
          name: m.name,
          photoURL: m.photoURL,
          valor: m.streakThisMonth ?? m.currentStreak ?? 0,
          unidad: 'días',
        }))}
      />

      {members.length === 0 ? (
        <EmptyState
          icon="trophy-outline"
          title="Aún no hay actividad"
          subtitle="Cuando tú y tus compañeros registréis entrenamientos, apareceréis aquí."
        />
      ) : (
        members.map((member, index) => {
          const isMe = member.uid === profile.uid;
          // Los tres primeros ya están en el podio, arriba. Repetirlos aquí
          // era contar lo mismo dos veces seguidas... salvo que uno de ellos
          // seas tú: tu fila sale siempre, porque es la que se viene a ver.
          if (index < 3 && !isMe) return null;
          return (
            <Card key={member.uid} style={[styles.row, isMe && styles.rowMe]}>
              <View style={styles.rankWrap}>
                <Text style={[styles.rankNumber, isMe && styles.rankNumberMe]}>
                  {index + 1}
                </Text>
              </View>
              <Avatar name={member.name} photoURL={member.photoURL} size={44} />
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, { flexShrink: 1 }]} numberOfLines={1}>
                    {member.name}
                  </Text>
                  {isMe ? <Text style={styles.youTag}>TÚ</Text> : null}
                  {/* El punto de "en línea" no se pinta en tu propia fila: que
                      estás conectado ya lo sabes, y ahí le robaba el sitio a tu
                      nombre hasta cortarlo. */}
                  {!isMe && isOnline(member.lastSeen) ? (
                    <View style={styles.onlineDot} />
                  ) : null}
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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.lg,
  },
  podiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  podiumTitle: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 3,
  },
  podiumPos: { ...typography.body, fontFamily: fonts.heading, minWidth: 26 },
  podiumName: { ...typography.small, color: colors.text, flex: 1 },
  podiumDias: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold },
  podiumVacio: { color: colors.textFaint },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  summaryCard: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  summaryValue: { ...typography.h2, color: colors.text, marginTop: spacing.xs },
  summaryLabel: {
    ...typography.small,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  rowMe: { borderColor: colors.primary },
  rankWrap: { width: 26, alignItems: 'center' },
  rankNumber: { ...typography.body, color: colors.textFaint, fontFamily: fonts.semiBold, ...tabularNums },
  // Cuerpo, no titular: el peso visual de la pantalla lo lleva el podio, y a
  // tamaño de titular un apellido normal ya no cabía en la fila.
  name: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  youTag: {
    fontSize: 10,
    flexShrink: 0,
    color: colors.primaryBright,
    fontFamily: fonts.semiBold,
    letterSpacing: 0.8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.hairlineFaint,
    backgroundColor: colors.primaryMuted,
    overflow: 'hidden',
  },
  rankNumberMe: { color: colors.primaryBright },
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
