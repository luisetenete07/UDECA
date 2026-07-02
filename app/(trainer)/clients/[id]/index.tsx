import React, { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Card';
import { EmptyState } from '../../../../components/EmptyState';
import { LoadingScreen } from '../../../../components/LoadingScreen';
import { ScreenContainer } from '../../../../components/ScreenContainer';
import { WeightChart } from '../../../../components/WeightChart';
import { getRoutinesForClient } from '../../../../lib/firestore/routines';
import { getUserProfile } from '../../../../lib/firestore/users';
import { getWeightLogsForClient } from '../../../../lib/firestore/weightLogs';
import { getWorkoutLogsForClient } from '../../../../lib/firestore/workoutLogs';
import { colors, radius, spacing, typography } from '../../../../lib/theme';
import type { Routine, UserProfile, WeightLog, WorkoutLog } from '../../../../lib/types';

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<UserProfile | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let cancelled = false;
      (async () => {
        const [clientData, routineData, weightData, workoutData] = await Promise.all([
          getUserProfile(id),
          getRoutinesForClient(id),
          getWeightLogsForClient(id),
          getWorkoutLogsForClient(id),
        ]);
        if (cancelled) return;
        setClient(clientData);
        setRoutines(routineData);
        setWeightLogs(weightData);
        setWorkoutLogs(workoutData);
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [id])
  );

  if (loading) return <LoadingScreen />;
  if (!client) return <EmptyState title="Cliente no encontrado" />;

  const activeRoutine = routines.find((r) => r.active);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{client.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{client.name}</Text>
          <Text style={styles.email}>{client.email}</Text>
        </View>
      </View>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Rutina asignada</Text>
        {activeRoutine ? (
          <>
            <Text style={styles.routineName}>{activeRoutine.name}</Text>
            <Text style={styles.routineMeta}>
              {activeRoutine.days.length} día(s) de entrenamiento
            </Text>
          </>
        ) : (
          <Text style={styles.mutedText}>Este cliente no tiene una rutina activa.</Text>
        )}
        <Button
          title={activeRoutine ? 'Editar rutina' : 'Crear rutina'}
          variant="secondary"
          onPress={() => router.push(`/(trainer)/clients/${id}/routine`)}
          style={{ marginTop: spacing.md }}
        />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Evolución del peso</Text>
        <WeightChart logs={weightLogs} />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Historial de entrenamientos</Text>
        {workoutLogs.length === 0 ? (
          <Text style={styles.mutedText}>Todavía no ha registrado entrenamientos.</Text>
        ) : (
          workoutLogs.slice(0, 10).map((log) => (
            <View key={log.id} style={styles.logRow}>
              <View>
                <Text style={styles.logTitle}>{log.dayName}</Text>
                <Text style={styles.logDate}>{new Date(log.date).toLocaleDateString('es-ES')}</Text>
              </View>
              <Text style={styles.logExercises}>{log.exercises.length} ejercicios</Text>
            </View>
          ))
        )}
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.h2, color: colors.white },
  name: { ...typography.h2, color: colors.text },
  email: { ...typography.small, color: colors.textMuted },
  section: { marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  routineName: { ...typography.body, color: colors.text, fontWeight: '700' },
  routineMeta: { ...typography.small, color: colors.textMuted },
  mutedText: { ...typography.small, color: colors.textFaint },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  logTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  logDate: { ...typography.small, color: colors.textFaint },
  logExercises: { ...typography.small, color: colors.textMuted },
});
