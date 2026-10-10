import React, { useCallback, useEffect, useState } from 'react';
import { frase } from '../../../lib/idioma';
import { useFocusEffect, useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../../../components/Texto';
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
import {
  getClientsForTrainer,
  setCoachingHasta,
  subscribeClientsForTrainer,
} from '../../../lib/firestore/users';
import { getWorkoutLogsForTrainer } from '../../../lib/firestore/workoutLogs';
import { QuickSheet } from '../../../components/QuickSheet';
import { ClasificacionDelGrupo } from '../../../components/ClasificacionDelGrupo';
import { getActiveRoutinesForTrainer } from '../../../lib/firestore/routines';
import { buildCsv, downloadCsv } from '../../../lib/exportCsv';
import { getCached, setCached } from '../../../lib/screenCache';
import { Chip, ChipRow } from '../../../components/Chip';
import { fechaNumerica, inicioDeLaSemana, inicioDelDia, masDias } from '../../../lib/fechas';
import { colors, fonts, radius, spacing, typography } from '../../../lib/theme';
import { alargar, coachingDe } from '../../../lib/coaching';
import { colorDelPeriodo, textoDelPeriodo } from '../../../components/PeriodoDeCoaching';

/** Por renovar: el periodo se acaba esta semana o ya se acabó (lib/coaching.ts). */
const porRenovar = (c: UserProfile) => {
  const e = coachingDe(c).estado;
  return e === 'acaba' || e === 'terminado' || e === 'pausado';
};
import {
  CLIENT_STATUS_LABEL,
  todayWeekday,
  type Routine,
  type UserProfile,
  type WorkoutLog,
} from '../../../lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Medianoche local del timestamp (para contar por días de calendario). */

/**
 * Última actividad como texto + tono: hoy/ayer verde, <7d ámbar, resto rojo.
 * Se cuenta por DÍAS DE CALENDARIO (no por periodos de 24 h), así "hoy" y
 * "ayer" cuadran con el día real aunque hayan pasado más o menos de 24 horas.
 */
function activityInfo(last?: number): { label: string; color: string } {
  if (!last) return { label: 'Sin entrenos', color: colors.textFaint };
  const days = Math.round((inicioDelDia(Date.now()) - inicioDelDia(last)) / DAY_MS);
  if (days <= 0) return { label: 'Hoy', color: colors.success };
  if (days === 1) return { label: 'Ayer', color: colors.success };
  if (days < 7) return { label: frase`Hace ${days} días`, color: '#C9902B' };
  return { label: frase`${days} días parado`, color: colors.danger };
}

/**
 * Entrenamientos que el alumno se ha SALTADO esta semana: días de entreno
 * (no descanso) con día de la semana asignado que ya han pasado (antes de hoy)
 * y en los que no registró ninguna sesión. Solo aplica a rutinas semanales
 * (en ciclo/sensaciones no hay día fijo, así que no se puede "saltar" uno).
 */
function skippedThisWeek(routine: Routine | null | undefined, trainedDays: Set<number>): number {
  if (!routine || (routine.schedule ?? 'weekly') !== 'weekly') return 0;
  const monday = inicioDeLaSemana(Date.now());
  const todayWd = todayWeekday();
  let skipped = 0;
  for (const day of routine.days) {
    if (day.isRest || day.optionalRest || day.weekday == null) continue;
    if (day.weekday >= todayWd) continue; // hoy o futuro: aún no cuenta
    if (!trainedDays.has(masDias(monday, day.weekday))) skipped++;
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
  const [soloRenovar, setSoloRenovar] = useState(false);
  // Orden: alfabético o por actividad (los que llevan más tiempo sin entrenar
  // primero, para actuar rápido con grupos grandes).
  const [sortMode, setSortMode] = useState<'name' | 'activity'>('name');
  const [error, setError] = useState<string | null>(null);
  // Alumno sobre el que se mantiene pulsado, para las acciones rápidas.
  const [rapidas, setRapidas] = useState<UserProfile | null>(null);

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
      const monday = inicioDeLaSemana(Date.now());
      const trainedByClient: Record<string, Set<number>> = {};
      for (const log of logs as WorkoutLog[]) {
        if (log.date < monday) continue;
        (trainedByClient[log.clientId] ??= new Set()).add(inicioDelDia(log.date));
      }
      getActiveRoutinesForTrainer(profile.uid)
        .then((rutinas) => {
          const skip: Record<string, number> = {};
          for (const c of data) {
            const n = skippedThisWeek(rutinas[c.uid] ?? null, trainedByClient[c.uid] ?? new Set());
            if (n > 0) skip[c.uid] = n;
          }
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
        (e) => showToast(frase`Lista en vivo no disponible: ${e.message}`)
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
        (!soloRenovar || porRenovar(c))
    )
    .sort((a, b) =>
      sortMode === 'activity'
        ? (lastTrained[a.uid] ?? 0) - (lastTrained[b.uid] ?? 0)
        : (a.name ?? '').localeCompare(b.name ?? '')
    );
  const cuantosPorRenovar = clients.filter(porRenovar).length;

  const handleExportCsv = () => {
    const fmt = (ts?: number) => (ts ? fechaNumerica(ts) : '');
    const rows = clients.map((c) => [
      c.name,
      c.email,
      fmt(c.nextPaymentDate),
      fmt(lastTrained[c.uid]),
      c.goal ?? '',
    ]);
    const csv = buildCsv(
      ['Nombre', 'Email', 'Coaching hasta', 'Última sesión', 'Objetivo'],
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

      {clients.length > 0 ? (
        <TextField
          placeholder="Buscar cliente..."
          value={search}
          onChangeText={setSearch}
          style={styles.search}
        />
      ) : null}

      {clients.length > 0 ? (
        <ChipRow scroll>
          <Chip
            texto={sortMode === 'activity' ? 'Menos activos primero' : 'A-Z'}
            icono="swap-vertical"
            activo={sortMode === 'activity'}
            onPress={() => setSortMode((m) => (m === 'name' ? 'activity' : 'name'))}
          />
          <Chip
            texto={`Todos (${clients.length})`}
            activo={!soloRenovar}
            onPress={() => setSoloRenovar(false)}
          />
          <Chip
            texto={frase`Por renovar (${cuantosPorRenovar})`}
            punto={colors.warning}
            activo={soloRenovar}
            onPress={() => setSoloRenovar((v) => !v)}
          />
        </ChipRow>
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
            onLongPress={() => setRapidas(client)}
            delayLongPress={280}
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
                  {/* El periodo de coaching, solo si tiene fecha: lo que se
                      lee es cuánto le queda, en el color de su estado. */}
                </View>
                {/* El periodo en su propia línea: al lado de la actividad no
                    cabía, y al partirse dejaba un punto colgando. */}
                {client.nextPaymentDate ? (
                  <Text style={[styles.payBadgeText, styles.periodoLinea, { color: colorDelPeriodo(coachingDe(client)) }]}>
                    {textoDelPeriodo(coachingDe(client))}
                  </Text>
                ) : null}
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
              {/* Las acciones rápidas, con botón visible además del gesto: un
                  atajo que solo existe si lo mantienes pulsado es un atajo que
                  nadie descubre, y por tanto una función que no existe. */}
              <Pressable
                onPress={() => setRapidas(client)}
                hitSlop={10}
                style={styles.masBtn}
                accessibilityLabel={frase`Acciones de ${client.name}`}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
              </Pressable>
          </CardButton>
          </FadeIn>
          );
        })}
        </Grid>
      )}

      {/* Las libretas de comida, debajo de los alumnos y no encima: se abren
          de vez en cuando, y la lista es a lo que se entra cada vez. */}
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

      {/* La clasificación del grupo, al final de la lista: estaba en el perfil
          del entrenador, que es el último sitio donde se busca a los alumnos. */}
      {profile && clients.length > 0 ? (
        <ClasificacionDelGrupo trainerId={profile.uid} />
      ) : null}

        {rapidas ? (
        <QuickSheet
          visible
          titulo={rapidas.name}
          subtitulo="Mantén pulsado sobre cualquier alumno para llegar aquí"
          onClose={() => setRapidas(null)}
          acciones={[
            {
              icono: 'barbell-outline',
              texto: 'Editar rutina',
              onPress: () => router.push(`/(trainer)/clients/${rapidas.uid}/routine`),
            },
            {
              icono: 'calendar-outline',
              texto: 'Planificación',
              onPress: () => router.push(`/(trainer)/clients/${rapidas.uid}/planning`),
            },
            {
              icono: 'nutrition-outline',
              texto: 'Plan nutricional',
              onPress: () => router.push(`/(trainer)/clients/${rapidas.uid}/nutrition`),
            },
            {
              icono: 'person-outline',
              texto: 'Abrir ficha',
              onPress: () => router.push(`/(trainer)/clients/${rapidas.uid}`),
            },
            // Renovar sin abrir la ficha: es lo que se hace casi siempre con
            // quien está en "Por renovar", y desde aquí son dos toques.
            ...(porRenovar(rapidas)
              ? [
                  {
                    icono: 'refresh-outline' as const,
                    texto: 'Renovar 1 mes',
                    onPress: async () => {
                      const c = rapidas;
                      const hasta = alargar(c.nextPaymentDate, 1);
                      setClients((prev) =>
                        prev.map((x) => (x.uid === c.uid ? { ...x, nextPaymentDate: hasta } : x))
                      );
                      try {
                        await setCoachingHasta(c.uid, hasta);
                        showToast(frase`${c.name.split(' ')[0]} · coaching hasta el ${fechaNumerica(hasta)}`);
                      } catch {
                        setClients((prev) => prev.map((x) => (x.uid === c.uid ? c : x)));
                        showToast('No se pudo renovar');
                      }
                    },
                  },
                ]
              : []),
          ]}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text },
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
  dot: { width: 8, height: 8, borderRadius: 4 },
  payBadgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 4 },
  payBadgeText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.medium, fontSize: 11 },
  periodoLinea: { marginTop: 2 },
  skipRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  skipText: { ...typography.small, color: colors.danger, fontFamily: fonts.semiBold, fontSize: 11 },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // La separación entre fichas la pone la rejilla, no la tarjeta.
    flex: 1,
  },
  masBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
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
