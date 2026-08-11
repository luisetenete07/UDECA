import React, { useCallback, useState } from 'react';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../components/Card';
import { CyclePlanSheet } from '../../components/CyclePlanSheet';
import { CycleSheet } from '../../components/CycleSheet';
import { EmptyState } from '../../components/EmptyState';
import { CardsSkeleton } from '../../components/Skeleton';
import { PlanCalendar } from '../../components/PlanCalendar';
import { ScreenContainer } from '../../components/ScreenContainer';
import { useAuth } from '../../lib/auth-context';
import { getCyclesForClient } from '../../lib/firestore/cycles';
import { getWorkoutLogsForClient } from '../../lib/firestore/workoutLogs';
import { buildCycleTree } from '../../lib/cyclePlan';
import { diaMes } from '../../lib/fechas';
import { colors, fonts, radius, spacing, typography } from '../../lib/theme';
import { CYCLE_LEVEL_LABEL, type TrainingCycle, type WorkoutLog } from '../../lib/types';

/**
 * La planificación del atleta: su temporada, montada por él.
 *
 * El entrenador ya podía repartir la temporada de sus alumnos en bloques y
 * semanas. El atleta no: se autoentrena, y precisamente por eso es quien más
 * lo necesita —no tiene a nadie que le diga cuándo toca apretar y cuándo
 * soltar—, pero lo único que tenía era la rutina de esta semana y ninguna
 * forma de ver hacia dónde iba.
 *
 * Es la misma planificación del entrenador, no una versión reducida: los
 * mismos bloques, las mismas descargas y el mismo calendario. Cambia solo
 * quién la escribe, y como el atleta es su propio entrenador, escribe la suya.
 */
export default function PlanningScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [cycles, setCycles] = useState<TrainingCycle[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sueltoAbierto, setSueltoAbierto] = useState(false);
  const [planAbierto, setPlanAbierto] = useState(false);

  const cargar = useCallback(async () => {
    if (!profile) return;
    // El atleta es su propio entrenador: pregunta por los ciclos en los que él
    // es las dos cosas.
    const [ciclos, entrenos] = await Promise.all([
      getCyclesForClient(profile.uid, profile.uid),
      getWorkoutLogsForClient(profile.uid),
    ]);
    setCycles(ciclos);
    setLogs(entrenos);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      cargar().catch(() => setLoading(false));
    }, [cargar])
  );

  if (loading) {
    return (
      <ScreenContainer>
        <CardsSkeleton tarjetas={2} />
      </ScreenContainer>
    );
  }

  const raiz = buildCycleTree(cycles);
  const planes = raiz.filter((n) => n.children.length > 0);
  const sueltos = raiz.filter((n) => n.children.length === 0);

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: 'Mi temporada' }} />
      <Pressable onPress={() => router.back()} style={styles.volver} hitSlop={8}>
        <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
        <Text style={styles.volverTexto}>Volver</Text>
      </Pressable>

      <Text style={styles.titulo}>Mi temporada</Text>
      <Text style={styles.subtitulo}>
        Reparte los próximos meses en bloques: acumular, apretar y soltar. Entrenar sin plan
        funciona unas semanas; a partir de ahí, lo que falta es saber cuándo bajar.
      </Text>

      <Pressable style={styles.botonPrincipal} onPress={() => setPlanAbierto(true)}>
        <Ionicons name="calendar" size={20} color={colors.onPrimary} />
        <Text style={styles.botonPrincipalTexto}>Nueva temporada</Text>
      </Pressable>
      <Pressable style={styles.botonSecundario} onPress={() => setSueltoAbierto(true)}>
        <Ionicons name="add" size={18} color={colors.primary} />
        <Text style={styles.botonSecundarioTexto}>Bloque suelto</Text>
      </Pressable>

      {cycles.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="Sin planificar"
          subtitle="Elige una plantilla y la app monta los bloques y las semanas, con sus descargas. Si prefieres no planificar, entrenas igual que siempre."
        />
      ) : null}

      {planes.map(({ cycle, children }) => (
        <Card key={cycle.id} style={styles.tarjetaPlan}>
          <View style={styles.cabeceraPlan}>
            <Text style={styles.nivel}>{CYCLE_LEVEL_LABEL[cycle.level]}</Text>
            <Text style={styles.nombrePlan} numberOfLines={1}>
              {cycle.name}
            </Text>
            <Text style={styles.fechasPlan}>
              {cycle.startDate ? diaMes(cycle.startDate) : 'Sin inicio'}
              {cycle.endDate ? ` – ${diaMes(cycle.endDate)}` : ''} · {children.length} bloque
              {children.length === 1 ? '' : 's'}
            </Text>
          </View>
          <View style={styles.separador} />
          <PlanCalendar root={cycle} cycles={cycles} logs={logs} />
        </Card>
      ))}

      {sueltos.length > 0 ? (
        <>
          <Text style={styles.etiquetaSeccion}>Bloques sueltos</Text>
          {sueltos.map(({ cycle }) => (
            <Card key={cycle.id} style={styles.tarjetaSuelto}>
              <Text style={styles.nombrePlan} numberOfLines={1}>
                {cycle.name}
              </Text>
              <Text style={styles.fechasPlan}>
                {CYCLE_LEVEL_LABEL[cycle.level]}
                {cycle.isDeload ? ' · descarga' : ''}
                {cycle.startDate ? ` · desde el ${diaMes(cycle.startDate)}` : ''}
              </Text>
            </Card>
          ))}
        </>
      ) : null}

      {profile ? (
        <>
          <CycleSheet
            visible={sueltoAbierto}
            trainerId={profile.uid}
            clientId={profile.uid}
            onClose={() => setSueltoAbierto(false)}
            onSaved={cargar}
          />
          <CyclePlanSheet
            visible={planAbierto}
            trainerId={profile.uid}
            clientId={profile.uid}
            onClose={() => setPlanAbierto(false)}
            onSaved={() => cargar()}
          />
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  volver: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: spacing.sm },
  volverTexto: { ...typography.small, color: colors.textMuted },
  titulo: { ...typography.h1, color: colors.text },
  subtitulo: {
    ...typography.small,
    color: colors.textMuted,
    lineHeight: 19,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  botonPrincipal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  botonPrincipalTexto: { ...typography.body, color: colors.onPrimary, fontFamily: fonts.semiBold },
  botonSecundario: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  botonSecundarioTexto: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  tarjetaPlan: { marginBottom: spacing.md },
  tarjetaSuelto: { marginBottom: spacing.sm },
  cabeceraPlan: { gap: 2 },
  nivel: {
    ...typography.label,
    color: colors.primaryBright,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 10,
  },
  nombrePlan: { ...typography.h3, color: colors.text },
  fechasPlan: { ...typography.small, color: colors.textMuted },
  separador: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  etiquetaSeccion: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
});
