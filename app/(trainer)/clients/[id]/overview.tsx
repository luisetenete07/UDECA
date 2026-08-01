import React, { useCallback, useState } from 'react';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { LoadingScreen } from '../../../../components/LoadingScreen';
import { ProgressMatrix } from '../../../../components/ProgressMatrix';
import { ScreenContainer } from '../../../../components/ScreenContainer';
import { useAuth } from '../../../../lib/auth-context';
import { getWorkoutLogsForClient } from '../../../../lib/firestore/workoutLogs';
import { getActiveRoutineForClient } from '../../../../lib/firestore/routines';
import { colors, spacing, typography } from '../../../../lib/theme';
import type { WorkoutLog } from '../../../../lib/types';

/**
 * Progreso total de un alumno: la mejor serie de cada ejercicio, semana a
 * semana, desde que entrena.
 *
 * Se llamaba "progreso semanal", que confundía: las columnas son semanas, pero
 * lo que se mira es la evolución completa, y con "Desde el inicio" abarca todo
 * el historial. La tabla es la misma que ve el alumno en su cuenta; aquí el
 * entrenador además elige qué ejercicios salen.
 */
export default function ClientOverviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [planExercises, setPlanExercises] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile || !id) return;
    try {
      const [data, rutina] = await Promise.all([
        getWorkoutLogsForClient(id, profile.uid),
        getActiveRoutineForClient(id, profile.uid).catch(() => null),
      ]);
      setLogs(data);
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

  if (loading) return <LoadingScreen />;

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: 'Progreso total' }} />
      <Text style={styles.title}>Progreso total</Text>
      <Text style={styles.subtitle}>
        La mejor serie de cada ejercicio, semana a semana. Elige qué ejercicios seguir: es la
        misma tabla que ve tu alumno.
      </Text>

      <ProgressMatrix
        logs={logs}
        clientId={String(id)}
        ownerId={profile?.uid}
        editable
        planExercises={planExercises}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text },
  subtitle: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: spacing.md,
  },
});
