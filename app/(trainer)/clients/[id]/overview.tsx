import React, { useCallback, useState } from 'react';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { BlockOverview } from '../../../../components/BlockOverview';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Card';
import { LoadingScreen } from '../../../../components/LoadingScreen';
import { ProgressMatrix } from '../../../../components/ProgressMatrix';
import { ScreenContainer } from '../../../../components/ScreenContainer';
import { showToast } from '../../../../components/Toast';
import { useAuth } from '../../../../lib/auth-context';
import { getCyclesForClient } from '../../../../lib/firestore/cycles';
import { getExerciseLibrary } from '../../../../lib/firestore/exercises';
import { getUserProfile } from '../../../../lib/firestore/users';
import { getWeightLogsForClient } from '../../../../lib/firestore/weightLogs';
import { getWorkoutLogsForClient } from '../../../../lib/firestore/workoutLogs';
import { getActiveRoutineForClient } from '../../../../lib/firestore/routines';
import { buildClientReportHtml } from '../../../../lib/report';
import { printReportHtml } from '../../../../lib/printReport';
import { buildBlockView } from '../../../../lib/blockView';
import { colors, spacing, typography } from '../../../../lib/theme';
import {
  CYCLE_LEVEL_LABEL,
  type Routine,
  type TrainingCycle,
  type UserProfile,
  type WeightLog,
  type WorkoutLog,
} from '../../../../lib/types';

/**
 * Progreso total de un alumno: la mejor serie de cada ejercicio, semana a
 * semana, desde que entrena.
 *
 * Se llamaba "progreso semanal", que confundía: las columnas son semanas, pero
 * lo que se mira es la evolución completa, y con "Desde el inicio" abarca todo
 * el historial. La tabla es la misma que ve el alumno en su cuenta; aquí el
 * entrenador además elige qué ejercicios salen.
 *
 * El informe en PDF se exporta desde el final de esta pantalla, y sale con lo
 * que se esté viendo: las mismas semanas y los mismos ejercicios en el mismo
 * orden.
 */
export default function ClientOverviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [client, setClient] = useState<UserProfile | null>(null);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [cycles, setCycles] = useState<TrainingCycle[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [muscleByExercise, setMuscleByExercise] = useState<Record<string, string>>({});
  const [measureByExercise, setMeasureByExercise] = useState<Record<string, string>>({});
  const [planExercises, setPlanExercises] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<{ weeks: number; exerciseIds: string[] }>({
    weeks: 8,
    exerciseIds: [],
  });
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!profile || !id) return;
    try {
      const [data, rutina, ficha, pesos, biblioteca, ciclos] = await Promise.all([
        getWorkoutLogsForClient(id, profile.uid),
        getActiveRoutineForClient(id, profile.uid).catch(() => null),
        getUserProfile(id).catch(() => null),
        getWeightLogsForClient(id, profile.uid).catch(() => []),
        getExerciseLibrary(profile.uid).catch(() => []),
        getCyclesForClient(profile.uid, id).catch(() => []),
      ]);
      setLogs(data);
      setRoutine(rutina);
      setCycles(ciclos);
      setClient(ficha);
      setWeightLogs(pesos);
      setMuscleByExercise(Object.fromEntries(biblioteca.map((e) => [e.id, e.muscleGroup])));
      setMeasureByExercise(Object.fromEntries(biblioteca.map((e) => [e.id, e.measure ?? 'reps'])));
      // Ejercicios del plan activo, sin repetir: son los que se pueden añadir a
      // la tabla aunque el alumno todavía no los haya registrado.
      const vistos = new Map<string, string>();
      for (const day of rutina?.days ?? []) {
        for (const ex of day.exercises) {
          if (!vistos.has(ex.exerciseId)) vistos.set(ex.exerciseId, ex.name);
        }
      }
      setPlanExercises([...vistos.entries()].map(([exId, name]) => ({ id: exId, name })));
    } catch {
      setLogs([]);
    }
    setLoading(false);
  }, [profile, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const exportarPdf = async () => {
    if (!client) return;
    setExporting(true);
    try {
      await printReportHtml(
        buildClientReportHtml({
          client,
          routine,
          weightLogs,
          workoutLogs: logs,
          muscleByExercise,
          measureByExercise,
          exerciseIds: view.exerciseIds,
          weeks: view.weeks,
          coachName: profile?.name,
        }),
        `informe-${client.name}`
      );
    } catch {
      showToast('No se pudo exportar el PDF');
    } finally {
      setExporting(false);
    }
  };

  if (loading) return <LoadingScreen />;

  // El bloque que se está viviendo. Se prefiere el mesociclo al macro: el
  // macro son meses y su reparto no dice nada accionable; el bloque sí.
  const ahora = Date.now();
  const enCurso = cycles.filter(
    (c) => (c.startDate ?? 0) <= ahora && (c.endDate ?? Number.MAX_SAFE_INTEGER) >= ahora
  );
  const bloqueActual =
    enCurso.find((c) => c.level === 'meso') ?? enCurso.find((c) => c.level === 'macro') ?? null;

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: '' }} />
      <Text style={styles.title}>Progreso total</Text>
      <Text style={styles.subtitle}>
        La mejor serie de cada ejercicio, semana a semana. Elige qué ejercicios seguir: es la
        misma tabla que ve tu alumno.
      </Text>

      <Card style={styles.blockCard}>
        <BlockOverview
          view={buildBlockView({
            cycle: bloqueActual,
            cycles,
            logs,
            routine,
            muscleByExercise,
            measureByExercise,
          })}
          title={bloqueActual ? bloqueActual.name : 'Últimas 4 semanas'}
          subtitle={
            bloqueActual
              ? CYCLE_LEVEL_LABEL[bloqueActual.level]
              : 'Sin bloque en curso · reparto reciente'
          }
        />
      </Card>

      <ProgressMatrix
        logs={logs}
        clientId={String(id)}
        ownerId={profile?.uid}
        editable
        planExercises={planExercises}
        onViewChange={setView}
      />

      {/* El informe cierra la pantalla: primero se mira, y si interesa, se
          exporta lo que se está mirando. */}
      <Button
        title="Exportar a PDF"
        variant="secondary"
        onPress={exportarPdf}
        loading={exporting}
        disabled={!client}
        style={{ marginTop: spacing.xl }}
      />
      <Text style={styles.exportHint}>
        Sale con las semanas y los ejercicios que tengas puestos ahora mismo.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  blockCard: { marginBottom: spacing.md },
  title: { ...typography.h1, color: colors.text },
  subtitle: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  exportHint: {
    ...typography.small,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
