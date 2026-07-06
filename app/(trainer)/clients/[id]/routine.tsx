import React, { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Card';
import { LoadingScreen } from '../../../../components/LoadingScreen';
import { ScreenContainer } from '../../../../components/ScreenContainer';
import { TextField } from '../../../../components/TextField';
import { useAuth } from '../../../../lib/auth-context';
import { getExercisesForTrainer } from '../../../../lib/firestore/exercises';
import {
  createRoutine,
  getActiveRoutineForClient,
  setActiveRoutine,
  updateRoutine,
} from '../../../../lib/firestore/routines';
import { notifyUser } from '../../../../lib/notifications';
import { fonts, colors, radius, spacing, typography } from '../../../../lib/theme';
import {
  WEEKDAY_LABELS,
  type Exercise,
  type RoutineDay,
  type RoutineExercise,
} from '../../../../lib/types';

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function RoutineEditorScreen() {
  const { id: clientId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [routineId, setRoutineId] = useState<string | null>(null);
  const [name, setName] = useState('Rutina personalizada');
  const [days, setDays] = useState<RoutineDay[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [pickerForDay, setPickerForDay] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId || !profile) return;
    (async () => {
      const [existing, library] = await Promise.all([
        getActiveRoutineForClient(clientId),
        getExercisesForTrainer(profile.uid),
      ]);
      setExercises(library);
      if (existing) {
        setRoutineId(existing.id);
        setName(existing.name);
        setDays(existing.days);
      } else {
        setDays([{ id: uid(), name: 'Día 1', exercises: [] }]);
      }
      setLoading(false);
    })();
  }, [clientId, profile]);

  const addDay = () => {
    setDays((prev) => [...prev, { id: uid(), name: `Día ${prev.length + 1}`, exercises: [] }]);
  };

  const removeDay = (dayId: string) => {
    setDays((prev) => prev.filter((d) => d.id !== dayId));
  };

  const updateDayName = (dayId: string, value: string) => {
    setDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, name: value } : d)));
  };

  // Asigna o quita el día de la semana (tocar el mismo chip lo desasigna).
  const updateDayWeekday = (dayId: string, weekday: number) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId ? { ...d, weekday: d.weekday === weekday ? undefined : weekday } : d
      )
    );
  };

  const addExerciseToDay = (dayId: string, exercise: Exercise) => {
    const routineExercise: RoutineExercise = {
      id: uid(),
      exerciseId: exercise.id,
      name: exercise.name,
      sets: 3,
      reps: '10',
    };
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId ? { ...d, exercises: [...d.exercises, routineExercise] } : d
      )
    );
    setPickerForDay(null);
  };

  const removeExercise = (dayId: string, exerciseRowId: string) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? { ...d, exercises: d.exercises.filter((e) => e.id !== exerciseRowId) }
          : d
      )
    );
  };

  const updateExerciseField = (
    dayId: string,
    exerciseRowId: string,
    field: 'sets' | 'reps',
    value: string
  ) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map((e) =>
                e.id === exerciseRowId
                  ? { ...e, [field]: field === 'sets' ? Number(value) || 0 : value }
                  : e
              ),
            }
          : d
      )
    );
  };

  const handleSave = useCallback(async () => {
    if (!profile || !clientId) return;
    setSaving(true);
    try {
      if (routineId) {
        await updateRoutine(routineId, { name, days });
        await setActiveRoutine(clientId, routineId);
      } else {
        const newId = await createRoutine({
          trainerId: profile.uid,
          clientId,
          name,
          days,
          active: true,
        });
        await setActiveRoutine(clientId, newId);
      }
      notifyUser(
        clientId,
        routineId ? 'Rutina actualizada' : 'Nueva rutina asignada',
        `Tu entrenador ha actualizado tu plan: ${name}`
      );
      router.back();
    } finally {
      setSaving(false);
    }
  }, [profile, clientId, routineId, name, days, router]);

  if (loading) return <LoadingScreen />;

  return (
    <ScreenContainer>
      <TextField label="Nombre de la rutina" value={name} onChangeText={setName} />

      {days.map((day) => (
        <Card key={day.id} style={styles.dayCard}>
          <View style={styles.dayHeader}>
            <TextField
              value={day.name}
              onChangeText={(v) => updateDayName(day.id, v)}
              style={styles.dayNameInput}
            />
            {days.length > 1 ? (
              <Pressable onPress={() => removeDay(day.id)} style={styles.removeDayBtn}>
                <Text style={styles.removeDayText}>Eliminar día</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.weekdayRow}>
            <Text style={styles.weekdayLabel}>Día de la semana</Text>
            <View style={styles.weekdayChips}>
              {WEEKDAY_LABELS.map((label, i) => (
                <Pressable
                  key={label}
                  onPress={() => updateDayWeekday(day.id, i)}
                  style={[styles.weekdayChip, day.weekday === i && styles.weekdayChipSelected]}
                  hitSlop={4}
                >
                  <Text
                    style={[
                      styles.weekdayChipText,
                      day.weekday === i && styles.weekdayChipTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {day.exercises.map((ex) => (
            <View key={ex.id} style={styles.exerciseRow}>
              <Text style={styles.exerciseName}>{ex.name}</Text>
              <View style={styles.exerciseFields}>
                <TextField
                  label="Series"
                  keyboardType="number-pad"
                  value={String(ex.sets)}
                  onChangeText={(v) => updateExerciseField(day.id, ex.id, 'sets', v)}
                  style={styles.smallInput}
                />
                <TextField
                  label="Reps"
                  value={ex.reps}
                  onChangeText={(v) => updateExerciseField(day.id, ex.id, 'reps', v)}
                  style={styles.smallInput}
                />
                <Pressable
                  onPress={() => removeExercise(day.id, ex.id)}
                  style={styles.deleteBtn}
                >
                  <Ionicons name="close" size={18} color={colors.danger} />
                </Pressable>
              </View>
            </View>
          ))}

          {pickerForDay === day.id ? (
            <View style={styles.picker}>
              {exercises.length === 0 ? (
                <Text style={styles.mutedText}>
                  No tienes ejercicios en tu biblioteca todavía. Créalos en la pestaña
                  Ejercicios.
                </Text>
              ) : (
                exercises.map((ex) => (
                  <Pressable
                    key={ex.id}
                    onPress={() => addExerciseToDay(day.id, ex)}
                    style={styles.pickerRow}
                  >
                    <Text style={styles.pickerRowText}>{ex.name}</Text>
                    <Text style={styles.pickerRowMuscle}>{ex.muscleGroup}</Text>
                  </Pressable>
                ))
              )}
              <Button
                title="Cancelar"
                variant="ghost"
                onPress={() => setPickerForDay(null)}
                style={{ marginTop: spacing.xs }}
              />
            </View>
          ) : (
            <Button
              title="+ Añadir ejercicio"
              variant="secondary"
              onPress={() => setPickerForDay(day.id)}
              style={{ marginTop: spacing.sm }}
            />
          )}
        </Card>
      ))}

      <Button title="+ Añadir día" variant="ghost" onPress={addDay} style={styles.addDayBtn} />

      <Button title="Guardar rutina" onPress={handleSave} loading={saving} style={styles.saveBtn} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  dayCard: { marginBottom: spacing.md },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayNameInput: { flex: 1, marginBottom: 0 },
  removeDayBtn: { paddingHorizontal: spacing.sm },
  removeDayText: { ...typography.small, color: colors.danger },
  weekdayRow: { marginTop: spacing.sm, marginBottom: spacing.sm },
  weekdayLabel: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  weekdayChips: { flexDirection: 'row', gap: spacing.xs },
  weekdayChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  weekdayChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  weekdayChipText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  weekdayChipTextSelected: { color: colors.onPrimary },
  exerciseRow: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  exerciseName: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, marginBottom: spacing.xs },
  exerciseFields: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  smallInput: { width: 80, marginBottom: 0 },
  deleteBtn: { marginLeft: 'auto', padding: spacing.xs },
  picker: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    maxHeight: 260,
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerRowText: { ...typography.body, color: colors.text },
  pickerRowMuscle: { ...typography.small, color: colors.textFaint },
  mutedText: { ...typography.small, color: colors.textFaint },
  addDayBtn: { marginBottom: spacing.lg },
  saveBtn: { marginBottom: spacing.xl },
});
