import React, { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../../components/Card';
import { EmptyState } from '../../../../components/EmptyState';
import { LoadingScreen } from '../../../../components/LoadingScreen';
import { ScreenContainer } from '../../../../components/ScreenContainer';
import { getWorkoutLog } from '../../../../lib/firestore/workoutLogs';
import { colors, fonts, spacing, typography } from '../../../../lib/theme';
import type { WorkoutLog } from '../../../../lib/types';

export default function SessionDetailScreen() {
  const { logId } = useLocalSearchParams<{ logId: string }>();
  const [log, setLog] = useState<WorkoutLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!logId) return;
    getWorkoutLog(logId).then((data) => {
      setLog(data);
      setLoading(false);
    });
  }, [logId]);

  if (loading) return <LoadingScreen />;
  if (!log) return <EmptyState title="Sesión no encontrada" />;

  return (
    <ScreenContainer>
      <Text style={styles.title}>{log.dayName}</Text>
      <Text style={styles.subtitle}>
        {log.routineName} · {new Date(log.date).toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}
      </Text>

      {log.exercises.map((ex, i) => {
        const done = ex.sets.filter((s) => s.completed).length;
        return (
          <Card key={ex.exerciseId + i} style={styles.card}>
            <View style={styles.exHeader}>
              <Text style={styles.exName}>{ex.name}</Text>
              <Text style={styles.exDone}>
                {done}/{ex.sets.length} series
              </Text>
            </View>
            {ex.sets.map((set, j) => (
              <View key={j} style={styles.setRow}>
                <Text style={styles.setLabel}>Serie {j + 1}</Text>
                <Text style={styles.setValue}>{set.reps || '—'} reps</Text>
                <Text style={styles.setValue}>{set.weight ? `${set.weight} kg` : '—'}</Text>
                <Ionicons
                  name={set.completed ? 'checkmark-circle' : 'ellipse-outline'}
                  size={18}
                  color={set.completed ? colors.primary : colors.textFaint}
                />
              </View>
            ))}
            {ex.notes ? <Text style={styles.notes}>{ex.notes}</Text> : null}
          </Card>
        );
      })}

      {log.feedback ? (
        <Card style={styles.card}>
          <Text style={styles.feedbackLabel}>Comentario del alumno</Text>
          <Text style={styles.feedback}>{log.feedback}</Text>
        </Card>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    textTransform: 'capitalize',
  },
  card: { marginBottom: spacing.md },
  exHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  exName: { ...typography.h3, color: colors.text, flex: 1 },
  exDone: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  setLabel: { ...typography.small, color: colors.textMuted, width: 56 },
  setValue: { ...typography.body, color: colors.text, flex: 1 },
  notes: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm, fontStyle: 'italic' },
  feedbackLabel: { ...typography.label, color: colors.textMuted, textTransform: 'uppercase' },
  feedback: { ...typography.body, color: colors.text, marginTop: spacing.xs },
});
