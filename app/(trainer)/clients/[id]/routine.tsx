import React, { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Card';
import { LoadingScreen } from '../../../../components/LoadingScreen';
import { ScreenContainer } from '../../../../components/ScreenContainer';
import { TextField } from '../../../../components/TextField';
import { showToast } from '../../../../components/Toast';
import { useAuth } from '../../../../lib/auth-context';
import { getExercisesForTrainer } from '../../../../lib/firestore/exercises';
import {
  createRoutine,
  getActiveRoutineForClient,
  setActiveRoutine,
  updateRoutine,
} from '../../../../lib/firestore/routines';
import { getClientsForTrainer } from '../../../../lib/firestore/users';
import { notifyUser } from '../../../../lib/notifications';
import { fonts, colors, radius, spacing, typography } from '../../../../lib/theme';
import {
  WEEKDAY_LABELS,
  type Exercise,
  type RoutineDay,
  type RoutineExercise,
  type UserProfile,
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
  const [copyPickerOpen, setCopyPickerOpen] = useState(false);
  const [otherClients, setOtherClients] = useState<UserProfile[]>([]);
  const [copying, setCopying] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId || !profile) return;
    (async () => {
      const [existing, library] = await Promise.all([
        getActiveRoutineForClient(clientId, profile.uid),
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
    field: 'sets' | 'reps' | 'restSeconds' | 'notes',
    value: string
  ) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map((e) =>
                e.id === exerciseRowId
                  ? {
                      ...e,
                      [field]:
                        field === 'sets' || field === 'restSeconds'
                          ? Number(value) || 0
                          : value,
                    }
                  : e
              ),
            }
          : d
      )
    );
  };

  // Encadena o desencadena un ejercicio en superserie con el anterior.
  const toggleSuperset = (dayId: string, exerciseRowId: string) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map((e) =>
                e.id === exerciseRowId
                  ? { ...e, supersetWithPrevious: !e.supersetWithPrevious }
                  : e
              ),
            }
          : d
      )
    );
  };

  // Mueve un ejercicio una posición arriba o abajo dentro de su día.
  const moveExercise = (dayId: string, index: number, delta: -1 | 1) => {
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d;
        const target = index + delta;
        if (target < 0 || target >= d.exercises.length) return d;
        const list = [...d.exercises];
        [list[index], list[target]] = [list[target], list[index]];
        return { ...d, exercises: list };
      })
    );
  };

  // Abre el selector de "copiar rutina de otro alumno".
  const openCopyPicker = async () => {
    if (!profile) return;
    setCopyPickerOpen(true);
    if (otherClients.length === 0) {
      const clients = await getClientsForTrainer(profile.uid);
      setOtherClients(clients.filter((c) => c.uid !== clientId));
    }
  };

  // Copia nombre y días (con ids nuevos) de la rutina activa de otro alumno.
  const copyFromClient = async (otherId: string) => {
    setCopying(true);
    try {
      const source = await getActiveRoutineForClient(otherId, profile?.uid);
      if (source) {
        setName(`${source.name}`);
        setDays(
          source.days.map((d) => ({
            ...d,
            id: uid(),
            exercises: d.exercises.map((e) => ({ ...e, id: uid() })),
          }))
        );
      }
      setCopyPickerOpen(false);
    } finally {
      setCopying(false);
    }
  };

  const handleSave = useCallback(async () => {
    if (!profile || !clientId) return;
    setSaving(true);
    try {
      if (routineId) {
        await updateRoutine(routineId, { name, days });
        await setActiveRoutine(clientId, routineId, profile.uid);
      } else {
        const newId = await createRoutine({
          trainerId: profile.uid,
          clientId,
          name,
          days,
          active: true,
        });
        await setActiveRoutine(clientId, newId, profile.uid);
      }
      notifyUser(
        clientId,
        routineId ? 'Rutina actualizada' : 'Nueva rutina asignada',
        `Tu entrenador ha actualizado tu plan: ${name}`
      );
      showToast('Rutina guardada');
      router.back();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'No se pudo guardar la rutina.');
    } finally {
      setSaving(false);
    }
  }, [profile, clientId, routineId, name, days, router]);

  if (loading) return <LoadingScreen />;

  return (
    <ScreenContainer>
      <TextField label="Nombre de la rutina" value={name} onChangeText={setName} />

      {copyPickerOpen ? (
        <Card style={styles.copyCard}>
          <Text style={styles.copyTitle}>Copiar la rutina activa de...</Text>
          {otherClients.length === 0 ? (
            <Text style={styles.mutedText}>Cargando alumnos...</Text>
          ) : (
            otherClients.map((c) => (
              <Pressable
                key={c.uid}
                onPress={() => copyFromClient(c.uid)}
                style={styles.pickerRow}
                disabled={copying}
              >
                <Text style={styles.pickerRowText}>{c.name}</Text>
                <Ionicons name="copy-outline" size={16} color={colors.primary} />
              </Pressable>
            ))
          )}
          <Button
            title="Cancelar"
            variant="ghost"
            onPress={() => setCopyPickerOpen(false)}
            style={{ marginTop: spacing.xs }}
          />
        </Card>
      ) : (
        <Button
          title="Copiar rutina de otro alumno"
          variant="secondary"
          onPress={openCopyPicker}
          style={{ marginBottom: spacing.md }}
        />
      )}

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

          {day.exercises.map((ex, exIndex) => (
            <View
              key={ex.id}
              style={[styles.exerciseRow, ex.supersetWithPrevious && styles.exerciseRowLinked]}
            >
              {ex.supersetWithPrevious ? (
                <View style={styles.supersetTag}>
                  <Ionicons name="link" size={12} color={colors.primaryBright} />
                  <Text style={styles.supersetTagText}>SUPERSERIE con el anterior</Text>
                </View>
              ) : null}
              <View style={styles.exerciseTitleRow}>
                <Text style={styles.exerciseName}>{ex.name}</Text>
                <Pressable
                  onPress={() => moveExercise(day.id, exIndex, -1)}
                  style={styles.moveBtn}
                  hitSlop={4}
                >
                  <Ionicons name="chevron-up" size={16} color={colors.textMuted} />
                </Pressable>
                <Pressable
                  onPress={() => moveExercise(day.id, exIndex, 1)}
                  style={styles.moveBtn}
                  hitSlop={4}
                >
                  <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
                </Pressable>
                <Pressable
                  onPress={() => removeExercise(day.id, ex.id)}
                  style={styles.deleteBtn}
                  hitSlop={4}
                >
                  <Ionicons name="close" size={18} color={colors.danger} />
                </Pressable>
              </View>
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
                <TextField
                  label="Descanso (s)"
                  keyboardType="number-pad"
                  value={ex.restSeconds ? String(ex.restSeconds) : ''}
                  onChangeText={(v) => updateExerciseField(day.id, ex.id, 'restSeconds', v)}
                  placeholder="90"
                  style={styles.smallInput}
                />
              </View>
              <TextField
                label="Indicaciones (opcional)"
                value={ex.notes ?? ''}
                onChangeText={(v) => updateExerciseField(day.id, ex.id, 'notes', v)}
                placeholder="Tempo, agarre, técnica..."
                style={{ marginBottom: 0, marginTop: spacing.xs }}
              />
              {exIndex > 0 ? (
                <Pressable onPress={() => toggleSuperset(day.id, ex.id)} style={styles.linkBtn}>
                  <Ionicons
                    name={ex.supersetWithPrevious ? 'unlink' : 'link'}
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={styles.linkBtnText}>
                    {ex.supersetWithPrevious
                      ? 'Quitar superserie'
                      : 'Superserie con el anterior'}
                  </Text>
                </Pressable>
              ) : null}
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

      {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
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
  exerciseName: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, flex: 1 },
  exerciseRowLinked: {
    borderLeftWidth: 2,
    borderLeftColor: colors.hairline,
    paddingLeft: spacing.sm,
  },
  exerciseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  exerciseFields: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  smallInput: { flex: 1, marginBottom: 0 },
  moveBtn: { padding: spacing.xs },
  deleteBtn: { padding: spacing.xs },
  supersetTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.xs,
  },
  supersetTagText: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    letterSpacing: 1,
    color: colors.primaryBright,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  linkBtnText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  copyCard: { marginBottom: spacing.md },
  copyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
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
  saveError: {
    ...typography.small,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  saveBtn: { marginBottom: spacing.xl },
});
