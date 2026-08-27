import { inicioDeLaSemana } from '../../lib/fechas';
import { frase } from '../../lib/idioma';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Redirect, useFocusEffect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../components/Texto';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { Podium } from '../../components/Podium';
import { Card } from '../../components/Card';
import { showToast } from '../../components/Toast';
import { EmptyState } from '../../components/EmptyState';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ScreenContainer } from '../../components/ScreenContainer';
import { useAuth } from '../../lib/auth-context';
import {
  compareLeaderboard,
  subscribeSocialLeaderboard,
  syncMySocialStats,
} from '../../lib/firestore/social';
import { getWorkoutLogsForClient } from '../../lib/firestore/workoutLogs';
import { monthKeyOf } from '../../lib/stats';
import { marcasCortas, textoDeMarcas } from '../../lib/marcas';
import { getUserProfile } from '../../lib/firestore/users';
import { tituloDeComunidad } from '../../lib/comunidad';
import { isOnline } from '../../lib/presence';
import { fonts, colors, radius, spacing, tabularNums, typography } from '../../lib/theme';
import type { SocialStats } from '../../lib/types';

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
  // El nombre del entrenador: la comunidad es SUYA, no de UDECA. Un alumno de
  // Luis entrena con Luis; que el rótulo dijera "Comunidad UDECA" le ponía por
  // delante una marca con la que él no ha hablado nunca.
  const [nombreDelCoach, setNombreDelCoach] = useState('');
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
    setRefreshing(false);
  }, [profile, withMine]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Se pide una vez y aguanta: el nombre del entrenador no cambia mientras se
  // mira la pantalla. Si falla, el rótulo se queda genérico y no pasa nada.
  useEffect(() => {
    const id = profile?.trainerId;
    if (!id) return;
    let vivo = true;
    getUserProfile(id)
      .then((p) => {
        if (vivo) setNombreDelCoach(p?.name?.trim() ?? '');
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [profile?.trainerId]);

  // Ranking en vivo: cualquier cambio en el grupo (una marca, un entreno nuevo,
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
          showToast(frase`Comunidad en vivo no disponible: ${e.message}`);
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

  const topMarcas = members.reduce((m, s) => Math.max(m, s.prsThisMonth ?? 0), 0);
  const totalSessions = members.reduce((sum, s) => sum + s.sessionsThisWeek, 0);

  // Podio del cambio de mes: los primeros 5 días del mes mostramos, de forma
  // discreta, el top 3 por MARCAS SUPERADAS el MES ANTERIOR. Solo cuentan miembros
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
   * Solo entran quienes SUPERARON alguna marca y tienen la ficha al día: lo
   * del mes anterior se recalcula al abrir la app, así que lo de alguien que
   * lleva meses sin entrar sería de otro mes distinto.
   *
   * Los desempates importan cuando dos hacen los mismos días: primero quien
   * más entrenó, y si sigue el empate, por nombre, que al menos es estable y
   * no cambia de orden en cada recarga.
   */
  const podium = showPodium
    ? members
        .filter((m) => m.monthKey === thisMonthKey && (m.lastMonthPrs ?? 0) > 0)
        .sort(
          (a, b) =>
            (b.lastMonthPrs ?? 0) - (a.lastMonthPrs ?? 0) ||
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
      <Text style={styles.title}>{tituloDeComunidad(nombreDelCoach)}</Text>
      <Text style={styles.subtitle}>Quién más se supera a sí mismo en tu coaching</Text>

      {/* Tres cifras en una fila, con rótulos de una palabra: se partían en
          tres líneas y hacían la tarjeta el doble de alta para decir lo
          mismo. */}
      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <Ionicons name="people" size={16} color={colors.primary} />
          <Text style={styles.summaryValue}>{members.length}</Text>
          <Text style={styles.summaryLabel} numberOfLines={1}>
            Miembros
          </Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Ionicons name="trending-up" size={16} color={colors.primary} />
          <Text style={styles.summaryValue}>{topMarcas}</Text>
          <Text style={styles.summaryLabel} numberOfLines={1}>
            Marcas
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
            <Text style={styles.podiumTitle}>Quién más se superó en {lastMonthName}</Text>
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
                  {m ? marcasCortas(m.lastMonthPrs ?? 0) : '—'}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {(() => {
        // Tablón de récords. Se destacan los de la semana natural (lunes 00:00
        // → domingo 23:59), pero si aún no hay ninguno —un lunes por la mañana
        // no lo habrá— se muestran los últimos conseguidos en vez de dejar el
        // tablón vacío: el mérito no desaparece al cambiar de semana.
        const weekStart = inicioDeLaSemana(Date.now());
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

      {/* Se clasifica por MARCAS SUPERADAS, no por días seguidos: lo que se
          premia es mejorar, no aparecer. Y una gripe ya no te deja fuera del
          mes a mitad de mes. */}
      <Text style={styles.sectionTitle}>Quién más se supera · este mes</Text>

      {/* Los tres primeros, por tamaño. Una clasificación se lee entera en el
          primer segundo o no se lee, y en una lista de tarjetas iguales el
          primero hay que buscarlo. */}
      <Podium
        yo={profile.uid}
        puestos={members.slice(0, 3).map((m) => ({
          uid: m.uid,
          name: m.name,
          photoURL: m.photoURL,
          valor: m.prsThisMonth ?? 0,
          unidad: 'marcas',
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
          // La lista los lleva a TODOS, del primero al último. Antes se
          // saltaban los tres del podio para no repetirlos, y el efecto era
          // que el segundo y el tercero desaparecían de la clasificación: no
          // estaban en la lista, y en el podio se ven como adorno, no como
          // puesto. Una clasificación a la que le faltan puestos no es una
          // clasificación, y justo a quien más cerca está de ganar es a quien
          // se le borraba.
          return (
            <Card key={member.uid} style={[styles.row, isMe && styles.rowMe]}>
              <View style={styles.rankWrap}>
                <Text style={[styles.rankNumber, isMe && styles.rankNumberMe]}>
                  {index + 1}
                </Text>
              </View>
              {/* 38 y no 44. En un móvil de 320 la fila lleva cinco cosas y
                  al nombre le quedaban 53 píxeles: "Marcos Ruiz" se veía
                  "Marc…". Seis píxeles de foto no los echa nadie de menos; un
                  ranking donde no se leen los nombres, sí. */}
              <Avatar name={member.name} photoURL={member.photoURL} size={38} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, { flexShrink: 1 }]} numberOfLines={2}>
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
                  {textoDeMarcas(member.prsThisMonth ?? 0)} · {member.workoutsThisMonth ?? 0}{' '}
                  entrenos este mes
                </Text>
              </View>
              <View style={styles.streakWrap}>
                <View style={styles.streakBadge}>
                  <Ionicons name="trending-up" size={14} color={colors.primary} />
                  <Text style={styles.streakValue}>{member.prsThisMonth ?? 0}</Text>
                </View>
                <Text style={styles.streakLabel}>marcas</Text>
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
  /*
   * Poco margen a los lados, que aquí no sobra ni un píxel.
   *
   * La tarjeta trae 22 de relleno por lado. Con tres en una fila de un móvil
   * estrecho, esos 44 se los quita al rótulo: a "Miembros" le quedaban menos
   * píxeles de los que mide y salía "Mie…", que no dice nada. La cifra manda
   * aquí; el aire de los lados no.
   */
  summaryCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  summaryValue: { ...typography.h2, color: colors.text, marginTop: spacing.xs },
  summaryLabel: {
    ...typography.small,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  /*
   * Separación corta entre las piezas de la fila.
   *
   * En la fila caben cinco cosas: el puesto, la foto, el nombre, lo que ha
   * hecho y las marcas. Con 16 de separación, los tres huecos se comían 48
   * píxeles que salían de la única parte elástica —el nombre—, y en un móvil
   * estrecho "Marcos Ruiz" acababa en "M…". Un ranking en el que no se leen
   * los nombres no es un ranking.
   */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowMe: { borderColor: colors.primary },
  rankWrap: { width: 22, alignItems: 'center' },
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
});
