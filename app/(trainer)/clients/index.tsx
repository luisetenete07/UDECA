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
import {
  getClientsForTrainer,
  setCoachingHasta,
  subscribeClientsForTrainer,
} from '../../../lib/firestore/users';
import { QuickSheet } from '../../../components/QuickSheet';
import { ClasificacionDelGrupo } from '../../../components/ClasificacionDelGrupo';
import { AccesoALibretas } from '../../../components/AccesoALibretas';
import { buildCsv, downloadCsv } from '../../../lib/exportCsv';
import { getCached, setCached } from '../../../lib/screenCache';
import { Chip, ChipRow } from '../../../components/Chip';
import { getAjustesLlamadas } from '../../../lib/firestore/llamadas';
import { fechaNumerica } from '../../../lib/fechas';
import { objetivosDe } from '../../../lib/objetivos';
import { colors, fonts, radius, spacing, typography } from '../../../lib/theme';
import { alargar, coachingDe } from '../../../lib/coaching';
import { colorDelPeriodo, textoDelPeriodo } from '../../../components/PeriodoDeCoaching';

/** Por renovar: el periodo se acaba esta semana o ya se acabó (lib/coaching.ts). */
const porRenovar = (c: UserProfile) => {
  const e = coachingDe(c).estado;
  return e === 'acaba' || e === 'terminado' || e === 'pausado';
};
import { CLIENT_STATUS_LABEL, type UserProfile } from '../../../lib/types';

/**
 * El objetivo que se enseña en la lista: el de corto plazo, que es el que se
 * trabaja ahora (o el primero que haya). El campo antiguo `goal` se vacía al
 * guardar los tres nuevos (lib/objetivos.ts), así que leerlo a él dejaba a
 * todos en "Sin objetivo definido".
 */
function objetivoDeLaLista(c: UserProfile): string {
  const o = objetivosDe(c);
  return o.corto || o.medio || o.largo;
}

/*
 * SIN "SE SALTÓ" NI "HACE X DÍAS".
 *
 * La lista decía cuándo entrenó cada alumno (aro de color, "Hace 3 días",
 * "12 días parado") y cuántos entrenos se saltó esta semana. Luis lo quitó: los
 * alumnos no apuntan cada entreno (lib/modoDeEntreno.ts), así que esas cifras
 * hablaban de registros, no de si entrenan, y señalaban a quien sí entrenaba.
 */

export default function ClientsScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  // Pinta al instante lo último conocido (caché de sesión) y refresca detrás.
  const cacheKey = `clients-${profile?.uid ?? ''}`;
  const [clients, setClients] = useState<UserProfile[]>(
    () => getCached<UserProfile[]>(cacheKey) ?? []
  );
  const [loading, setLoading] = useState(() => getCached(cacheKey) === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [soloRenovar, setSoloRenovar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Alumno sobre el que se mantiene pulsado, para las acciones rápidas.
  const [rapidas, setRapidas] = useState<UserProfile | null>(null);
  // Los planes de sus alumnos (Llamadas 1:1): su nombre, junto al del alumno.
  const [planes, setPlanes] = useState<Record<string, string>>(
    () => getCached<Record<string, string>>(`${cacheKey}-planes`) ?? {}
  );

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      const data = await getClientsForTrainer(profile.uid);
      setClients(data);
      setCached(cacheKey, data);
      getAjustesLlamadas(profile.uid)
        .then((a) => {
          const nombres = Object.fromEntries(a.planes.map((p) => [p.id, p.nombre]));
          setPlanes(nombres);
          setCached(`${cacheKey}-planes`, nombres);
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
  // lista sin refrescar ni volver atrás. Los nombres de los planes los sigue
  // trayendo `load`. Solo escucha mientras la lista está delante.
  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      return subscribeClientsForTrainer(
        profile.uid,
        (data) => {
          setClients(data);
          setCached(cacheKey, data);
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
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  const cuantosPorRenovar = clients.filter(porRenovar).length;

  const handleExportCsv = () => {
    const fmt = (ts?: number) => (ts ? fechaNumerica(ts) : '');
    const rows = clients.map((c) => [
      c.name,
      c.email,
      fmt(c.nextPaymentDate),
      objetivoDeLaLista(c),
    ]);
    const csv = buildCsv(
      ['Nombre', 'Email', 'Coaching hasta', 'Objetivo'],
      rows
    );
    const stamp = new Date().toISOString().slice(0, 10);
    if (!downloadCsv(`calico-clientes-${stamp}.csv`, csv)) {
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
          return (
          <FadeIn key={client.uid} delay={Math.min(index * 40, 280)}>
          <CardButton
            onPress={() => router.push(`/(trainer)/clients/${client.uid}`)}
            onLongPress={() => setRapidas(client)}
            delayLongPress={280}
            style={styles.clientCard}
          >
              <Avatar name={client.name} photoURL={client.photoURL} size={46} />
              <View style={{ flex: 1 }}>
                <View style={styles.nombreFila}>
                  <Text style={[styles.clientName, { flexShrink: 1 }]} numberOfLines={1}>
                    {client.name}
                  </Text>
                  {client.planId && planes[client.planId] ? (
                    <Text style={styles.planEtiqueta} numberOfLines={1}>
                      {planes[client.planId]}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.clientGoal} numberOfLines={1}>
                  {objetivoDeLaLista(client) || 'Sin objetivo definido'}
                </Text>
                {/* El periodo de coaching, solo si tiene fecha: lo que se lee
                    es cuánto le queda, en el color de su estado. */}
                {client.nextPaymentDate ? (
                  <Text style={[styles.payBadgeText, styles.periodoLinea, { color: colorDelPeriodo(coachingDe(client)) }]}>
                    {textoDelPeriodo(coachingDe(client))}
                  </Text>
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

      {/* TU GRUPO: lo que es de todos a la vez, debajo de la lista. La
          clasificación primero —se mira a menudo y tiene algo que enseñar— y
          las libretas de comida después, que se abren de vez en cuando. */}
      {profile && clients.length > 0 ? (
        <>
          <Text style={styles.grupoRotulo}>Tu grupo</Text>
          <ClasificacionDelGrupo trainerId={profile.uid} />
        </>
      ) : null}
      {profile ? <AccesoALibretas trainerId={profile.uid} /> : null}

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
  search: { marginBottom: spacing.sm },
  grupoRotulo: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  payBadgeText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.medium, fontSize: 11 },
  periodoLinea: { marginTop: 4 },
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
  clientName: { ...typography.h3, color: colors.text },
  clientGoal: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  nombreFila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planEtiqueta: {
    ...typography.small,
    fontSize: 11,
    color: colors.primary,
    fontFamily: fonts.semiBold,
    backgroundColor: colors.primaryMuted,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
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
