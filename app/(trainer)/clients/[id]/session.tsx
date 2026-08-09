import React, { useEffect, useState } from 'react';
import { diaLargo } from '../../../../lib/fechas';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../../components/Card';
import { EmptyState } from '../../../../components/EmptyState';
import { LoadingScreen } from '../../../../components/LoadingScreen';
import { ScreenContainer } from '../../../../components/ScreenContainer';
import { getWorkoutLog } from '../../../../lib/firestore/workoutLogs';
import { colors, fonts, spacing, typography } from '../../../../lib/theme';
import { isDualMeasure, setMarks, type WorkoutLog } from '../../../../lib/types';

export default function SessionDetailScreen() {
  const { logId, id } = useLocalSearchParams<{ logId: string; id: string }>();
  const router = useRouter();
  const [log, setLog] = useState<WorkoutLog | null>(null);
  const [loading, setLoading] = useState(true);

  // Al llegar desde la actividad del panel, la pila de Clientes se abre sin
  // historial y no habría flecha para volver. Forzamos un botón que lleva a la
  // ficha del cliente (sección Clientes) siempre.
  const goToClient = () => {
    if (id) router.replace(`/(trainer)/clients/${id}`);
    else router.replace('/(trainer)/clients');
  };
  const backButton = () => (
    <Pressable onPress={goToClient} hitSlop={10} style={styles.backBtn}>
      <Ionicons name="chevron-back" size={24} color={colors.primary} />
      <Text style={styles.backText}>Cliente</Text>
    </Pressable>
  );

  useEffect(() => {
    if (!logId) return;
    getWorkoutLog(logId).then((data) => {
      setLog(data);
      setLoading(false);
    });
  }, [logId]);

  if (loading)
    return (
      <>
        <Stack.Screen options={{ headerLeft: backButton }} />
        <LoadingScreen />
      </>
    );
  if (!log)
    return (
      <>
        <Stack.Screen options={{ headerLeft: backButton }} />
        <EmptyState title="Sesión no encontrada" />
      </>
    );

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerLeft: backButton }} />
      <Text style={styles.title}>{log.dayName}</Text>
      <Text style={styles.subtitle}>
        {log.routineName} · {diaLargo(log.date)}
      </Text>

      {log.exercises.map((ex, i) => {
        const done = ex.sets.filter((s) => s.completed).length;
        const unit = ex.measure === 'seconds' ? 's' : 'reps';
        // Solo mostramos la columna de carga si el ejercicio tuvo algún valor.
        const showLoad = ex.sets.some((s) => s.weight);
        const loadUnit = ex.load === 'assisted' ? 'goma' : 'kg';
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
                <Text style={styles.setValue}>
                  {/* En clúster la serie fueron varios bloques ("3+3+3"): se
                      enseñan todos, que es lo que de verdad hizo. */}
                  {set.clusters?.length ? setMarks(set).join('+') : set.reps || '—'} {unit}
                  {/* En un combo la serie lleva además el aguante. */}
                  {ex.measure === 'combo' && set.seconds ? ` · ${set.seconds} s` : ''}
                  {/* Por lados: se ve cada brazo por separado, que es justo
                      para lo que se anota así. */}
                  {isDualMeasure(ex.measure) && set.side2 ? ` · ${set.side2} ${unit} (der.)` : ''}
                </Text>
                {showLoad ? (
                  <Text style={styles.setValue}>
                    {set.weight ? `${set.weight} ${loadUnit}` : '—'}
                  </Text>
                ) : null}
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
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: spacing.sm },
  backText: { ...typography.body, color: colors.primary, fontFamily: fonts.medium },
  title: { ...typography.h1, color: colors.text },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.lg,
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
