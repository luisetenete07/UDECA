import React, { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  resolveLoad,
  WEEKDAY_LABELS,
  type Exercise,
  type RoutineDay,
  type RoutineExercise,
  type RoutineSchedule,
  type UserProfile,
} from '../../../../lib/types';

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Convierte el texto del descanso a segundos. Se escribe en MINUTOS
 * (admite decimales: "1.5" o "1,5" = 1 min 30 s). También acepta "mm:ss"
 * por si el coach lo escribe así.
 */
function parseClock(value: string): number {
  const t = value.trim().replace(',', '.');
  if (!t) return 0;
  if (t.includes(':')) {
    const [m, sec] = t.split(':');
    const mm = parseInt(m, 10) || 0;
    const ss = parseInt(sec, 10) || 0;
    return mm * 60 + ss;
  }
  const mins = parseFloat(t);
  if (Number.isNaN(mins) || mins < 0) return 0;
  return Math.round(mins * 60);
}

/** Formatea segundos como minutos para el campo ("1,5" · vacío si no hay). */
function formatClock(seconds?: number): string {
  if (!seconds) return '';
  const rounded = Math.round((seconds / 60) * 100) / 100;
  return String(rounded).replace('.', ',');
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
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [schedule, setSchedule] = useState<RoutineSchedule>('weekly');
  const [cycleStartDate, setCycleStartDate] = useState<number>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });
  const [restText, setRestText] = useState<Record<string, string>>({});

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
        setSchedule(existing.schedule ?? 'weekly');
        if (existing.cycleStartDate) setCycleStartDate(existing.cycleStartDate);
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

  // Marca/desmarca un día del ciclo como descanso (Método REIN TENA).
  const toggleRestDay = (dayId: string) => {
    setDays((prev) =>
      prev.map((d) => (d.id === dayId ? { ...d, isRest: !d.isRest } : d))
    );
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
      reps: exercise.measure === 'seconds' ? '30' : '10',
      measure: exercise.measure ?? 'reps',
      load: resolveLoad(exercise),
      band: exercise.band ?? false,
    };
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId ? { ...d, exercises: [...d.exercises, routineExercise] } : d
      )
    );
    showToast(`${exercise.name} añadido`);
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
    field: 'sets' | 'reps' | 'restSeconds' | 'notes' | 'rir',
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
                        field === 'sets' || field === 'restSeconds' || field === 'rir'
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

  // Ajusta la intensidad (1-10) de un día del ciclo (Método REIN TENA).
  const updateDayIntensity = (dayId: string, delta: number) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? { ...d, intensity: Math.max(1, Math.min(10, (d.intensity ?? 5) + delta)) }
          : d
      )
    );
  };

  // Descanso en formato mm:ss; se guarda en segundos.
  const updateRestSeconds = (dayId: string, exerciseRowId: string, seconds: number) => {
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              exercises: d.exercises.map((e) =>
                e.id === exerciseRowId ? { ...e, restSeconds: seconds } : e
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
      const scheduleFields = {
        schedule,
        cycleStartDate: schedule === 'cycle' ? cycleStartDate : undefined,
      };
      if (routineId) {
        await updateRoutine(routineId, { name, days, ...scheduleFields });
        await setActiveRoutine(clientId, routineId, profile.uid);
      } else {
        const newId = await createRoutine({
          trainerId: profile.uid,
          clientId,
          name,
          days,
          active: true,
          ...scheduleFields,
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
  }, [profile, clientId, routineId, name, days, schedule, cycleStartDate, router]);

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

      <Card accent style={styles.scheduleCard}>
        <Text style={styles.scheduleTitle}>Programación</Text>
        <View style={styles.modeRow}>
          <Pressable
            onPress={() => setSchedule('weekly')}
            style={[styles.modeBtn, schedule === 'weekly' && styles.modeBtnActive]}
          >
            <Text style={[styles.modeText, schedule === 'weekly' && styles.modeTextActive]}>
              Días de la semana
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSchedule('cycle')}
            style={[styles.modeBtn, schedule === 'cycle' && styles.modeBtnActive]}
          >
            <Text style={[styles.modeText, schedule === 'cycle' && styles.modeTextActive]}>
              Método REIN TENA
            </Text>
          </Pressable>
        </View>

        {schedule === 'cycle' ? (
          <>
            <Text style={styles.scheduleHint}>
              Los {days.length} días rotan en ciclo constante (Día 1 → {days.length} → repite), sin
              depender del día de la semana. La intensidad se ajusta en cada día, abajo.
            </Text>

            <Pressable
              onPress={() => {
                const d = new Date();
                d.setHours(0, 0, 0, 0);
                setCycleStartDate(d.getTime());
                showToast('Ciclo reiniciado hoy');
              }}
              style={styles.cycleResetBtn}
            >
              <Ionicons name="refresh" size={14} color={colors.primary} />
              <Text style={styles.cycleResetText}>
                Empezar ciclo hoy · actual:{' '}
                {new Date(cycleStartDate).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                })}
              </Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.scheduleHint}>
            Asigna cada día a un día de la semana con los botones L-D de abajo.
          </Text>
        )}
      </Card>

      {days.map((day, dayIndex) => (
        <Card key={day.id} style={styles.dayCard}>
          <View style={styles.dayHeader}>
            <TextField
              value={day.name}
              onChangeText={(v) => updateDayName(day.id, v)}
              style={styles.dayNameInput}
            />
            <Pressable onPress={() => removeDay(day.id)} style={styles.removeDayBtn} hitSlop={6}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
          </View>

          {schedule === 'cycle' ? (
            <>
            <View style={styles.cycleDayRow}>
              <View style={styles.cyclePill}>
                <Text style={styles.cyclePillText}>Día {dayIndex + 1} del ciclo</Text>
              </View>
              <Pressable
                onPress={() => toggleRestDay(day.id)}
                style={[styles.restToggle, day.isRest && styles.restToggleOn]}
                hitSlop={4}
              >
                <Ionicons
                  name={day.isRest ? 'bed' : 'bed-outline'}
                  size={14}
                  color={day.isRest ? colors.onPrimary : colors.textMuted}
                />
                <Text style={[styles.restToggleText, day.isRest && styles.restToggleTextOn]}>
                  Descanso
                </Text>
              </Pressable>
            </View>
            {!day.isRest ? (
              <View style={styles.dayIntensityRow}>
                <Text style={styles.dayIntensityLabel}>
                  Intensidad · {day.intensity ?? 5}/10
                </Text>
                <View style={styles.dayIntensityControls}>
                  <Pressable
                    onPress={() => updateDayIntensity(day.id, -1)}
                    style={styles.stepBtn}
                    hitSlop={6}
                  >
                    <Ionicons name="remove" size={16} color={colors.text} />
                  </Pressable>
                  <View style={styles.intensityTrack}>
                    <View
                      style={[
                        styles.intensityFill,
                        { width: `${((day.intensity ?? 5) / 10) * 100}%` },
                      ]}
                    />
                  </View>
                  <Pressable
                    onPress={() => updateDayIntensity(day.id, 1)}
                    style={styles.stepBtn}
                    hitSlop={6}
                  >
                    <Ionicons name="add" size={16} color={colors.text} />
                  </Pressable>
                </View>
              </View>
            ) : null}
            </>
          ) : (
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
          )}

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
                <Text style={styles.exerciseName}>
                  {ex.name}
                  {resolveLoad(ex) === 'assisted' ? '  🟡' : resolveLoad(ex) === 'weighted' ? '  🏋️' : ''}
                </Text>
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
                  label={ex.measure === 'seconds' ? 'Segundos' : 'Reps'}
                  value={ex.reps}
                  onChangeText={(v) => updateExerciseField(day.id, ex.id, 'reps', v)}
                  style={styles.smallInput}
                />
              </View>
              <View style={styles.exerciseFields}>
                <TextField
                  label="RIR"
                  keyboardType="number-pad"
                  value={ex.rir !== undefined ? String(ex.rir) : ''}
                  onChangeText={(v) => updateExerciseField(day.id, ex.id, 'rir', v)}
                  placeholder="2"
                  style={styles.smallInput}
                />
                <TextField
                  label="Descanso (min)"
                  keyboardType="numbers-and-punctuation"
                  value={restText[ex.id] ?? formatClock(ex.restSeconds)}
                  onChangeText={(v) => {
                    setRestText((prev) => ({ ...prev, [ex.id]: v }));
                    updateRestSeconds(day.id, ex.id, parseClock(v));
                  }}
                  placeholder="1.5"
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

          <Button
            title="+ Añadir ejercicio"
            variant="secondary"
            onPress={() => {
              setExerciseSearch('');
              setPickerForDay(day.id);
            }}
            style={{ marginTop: spacing.sm }}
          />
        </Card>
      ))}

      <Modal
        visible={pickerForDay !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerForDay(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Añadir ejercicio</Text>
              <Pressable onPress={() => setPickerForDay(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <TextField
              placeholder="Buscar ejercicio..."
              value={exerciseSearch}
              onChangeText={setExerciseSearch}
              autoCapitalize="none"
              style={{ marginBottom: spacing.sm }}
            />
            {exercises.length === 0 ? (
              <Text style={styles.mutedText}>
                No tienes ejercicios en tu biblioteca todavía. Créalos en la pestaña Ejercicios.
              </Text>
            ) : (
              <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
                {exercises
                  .filter((ex) =>
                    ex.name.toLowerCase().includes(exerciseSearch.toLowerCase().trim())
                  )
                  .map((ex) => (
                    <Pressable
                      key={ex.id}
                      onPress={() => pickerForDay && addExerciseToDay(pickerForDay, ex)}
                      style={styles.pickerRow}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickerRowText}>
                          {ex.name}
                          {resolveLoad(ex) === 'assisted' ? '  🟡' : resolveLoad(ex) === 'weighted' ? '  🏋️' : ''}
                        </Text>
                        <Text style={styles.pickerRowMuscle}>
                          {ex.muscleGroup}
                          {ex.measure === 'seconds' ? ' · isométrico' : ''}
                        </Text>
                      </View>
                      <Ionicons name="add-circle" size={22} color={colors.primary} />
                    </Pressable>
                  ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Button title="+ Añadir día" variant="ghost" onPress={addDay} style={styles.addDayBtn} />

      {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
      <Button title="Guardar rutina" onPress={handleSave} loading={saving} style={styles.saveBtn} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  dayCard: { marginBottom: spacing.md },
  scheduleCard: { marginBottom: spacing.md },
  scheduleTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.xs,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  modeBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  modeBtnActive: { backgroundColor: colors.primary },
  modeText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  modeTextActive: { color: colors.onPrimary },
  scheduleHint: { ...typography.small, color: colors.textMuted, lineHeight: 18 },
  dayIntensityRow: { marginBottom: spacing.sm },
  dayIntensityLabel: {
    ...typography.label,
    color: colors.primaryBright,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  dayIntensityControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  intensityLabel: {
    ...typography.label,
    color: colors.primaryBright,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  intensityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  intensityTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  intensityFill: { height: '100%', backgroundColor: colors.primary },
  cycleResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  cycleResetText: { ...typography.small, color: colors.primary, fontFamily: fonts.medium },
  cycleDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  cyclePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  cyclePillText: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold, fontSize: 11 },
  restToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  restToggleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  restToggleText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold, fontSize: 12 },
  restToggleTextOn: { color: colors.onPrimary },
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
  exerciseFields: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.xs },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: { ...typography.h2, color: colors.text },
  modalList: { maxHeight: 420 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
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
