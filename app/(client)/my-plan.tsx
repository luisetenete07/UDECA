import React, { useCallback, useState } from 'react';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import {
  createRoutine,
  getActiveRoutineForClient,
  setActiveRoutine,
  updateRoutine,
} from '../../lib/firestore/routines';
import { colors, fonts, radius, spacing, typography } from '../../lib/theme';
import type { ExerciseMeasure, Routine, RoutineDay, RoutineExercise } from '../../lib/types';

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const slug = (s: string) =>
  'self-' +
  (s || 'ej')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

function newExercise(): RoutineExercise {
  return { id: uid(), exerciseId: slug(''), name: '', sets: 4, reps: '10', measure: 'reps' };
}
function newDay(n: number): RoutineDay {
  return { id: uid(), name: `Día ${n}`, exercises: [newExercise()] };
}

export default function MyPlanScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [routineId, setRoutineId] = useState<string | null>(null);
  const [name, setName] = useState('Mi plan');
  const [days, setDays] = useState<RoutineDay[]>([]);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const r = await getActiveRoutineForClient(profile.uid, profile.uid);
      if (r) {
        setRoutineId(r.id);
        setName(r.name);
        setDays(r.days.length ? r.days : [newDay(1)]);
      } else {
        setRoutineId(null);
        setName('Mi plan');
        setDays([newDay(1)]);
      }
    } catch {
      setDays([newDay(1)]);
    }
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const patchDay = (di: number, patch: Partial<RoutineDay>) =>
    setDays((prev) => prev.map((d, i) => (i === di ? { ...d, ...patch } : d)));
  const patchEx = (di: number, ei: number, patch: Partial<RoutineExercise>) =>
    setDays((prev) =>
      prev.map((d, i) =>
        i === di
          ? { ...d, exercises: d.exercises.map((e, j) => (j === ei ? { ...e, ...patch } : e)) }
          : d
      )
    );

  const handleSave = async () => {
    if (!profile) return;
    const clean = days
      .map((d) => ({
        ...d,
        exercises: d.isRest
          ? []
          : d.exercises
              .filter((e) => e.name.trim())
              .map((e) => ({ ...e, exerciseId: slug(e.name) })),
      }))
      .filter((d) => d.name.trim() && (d.isRest || d.exercises.length > 0));
    if (clean.length === 0) {
      showToast('Añade al menos un día con ejercicios');
      return;
    }
    setSaving(true);
    try {
      if (routineId) {
        await updateRoutine(routineId, { name: name.trim() || 'Mi plan', days: clean });
        showToast('Plan guardado');
      } else {
        const id = await createRoutine({
          trainerId: profile.uid,
          clientId: profile.uid,
          name: name.trim() || 'Mi plan',
          active: true,
          days: clean,
          schedule: 'flex',
          scheduleLabel: 'Mi plan',
        } as Omit<Routine, 'id' | 'createdAt' | 'updatedAt'>);
        await setActiveRoutine(profile.uid, id, profile.uid);
        setRoutineId(id);
        showToast('Plan creado. ¡A entrenar!');
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: 'Mi plan' }} />
      <Text style={styles.title}>Mi plan</Text>
      <Text style={styles.subtitle}>
        Crea tus días de entreno. Cada vez que entrenes eliges cuál hacer.
      </Text>

      <TextField label="Nombre del plan" value={name} onChangeText={setName} />

      {days.map((day, di) => (
        <Card key={day.id} style={styles.dayCard}>
          <View style={styles.dayHead}>
            <TextInput
              value={day.name}
              onChangeText={(v) => patchDay(di, { name: v })}
              placeholder={`Día ${di + 1}`}
              placeholderTextColor={colors.textFaint}
              style={styles.dayName}
            />
            <Pressable onPress={() => setDays((p) => p.filter((_, i) => i !== di))} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
          </View>

          <View style={styles.restRow}>
            <Text style={styles.restLabel}>Día de descanso</Text>
            <Switch
              value={!!day.isRest}
              onValueChange={(v) => patchDay(di, { isRest: v })}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>

          {!day.isRest ? (
            <>
              {day.exercises.map((ex, ei) => (
                <View key={ex.id} style={styles.exBlock}>
                  <View style={styles.exTopRow}>
                    <TextInput
                      value={ex.name}
                      onChangeText={(v) => patchEx(di, ei, { name: v })}
                      placeholder="Ejercicio (ej. Dominadas)"
                      placeholderTextColor={colors.textFaint}
                      style={styles.exName}
                    />
                    <Pressable
                      onPress={() =>
                        patchDay(di, { exercises: day.exercises.filter((_, j) => j !== ei) })
                      }
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                  <View style={styles.exFields}>
                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>Series</Text>
                      <TextInput
                        value={String(ex.sets)}
                        onChangeText={(v) => patchEx(di, ei, { sets: Math.max(1, parseInt(v, 10) || 1) })}
                        keyboardType="number-pad"
                        style={styles.fieldInput}
                      />
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.fieldLabel}>
                        {ex.measure === 'seconds' ? 'Segundos' : 'Reps'}
                      </Text>
                      <TextInput
                        value={ex.reps}
                        onChangeText={(v) => patchEx(di, ei, { reps: v })}
                        style={styles.fieldInput}
                      />
                    </View>
                    <Pressable
                      style={styles.measureBtn}
                      onPress={() =>
                        patchEx(di, ei, {
                          measure: (ex.measure === 'seconds' ? 'reps' : 'seconds') as ExerciseMeasure,
                        })
                      }
                    >
                      <Text style={styles.measureText}>
                        {ex.measure === 'seconds' ? 'Segundos' : 'Reps'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
              <Pressable
                style={styles.addEx}
                onPress={() => patchDay(di, { exercises: [...day.exercises, newExercise()] })}
              >
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text style={styles.addExText}>Añadir ejercicio</Text>
              </Pressable>
            </>
          ) : null}
        </Card>
      ))}

      <Button
        title="Añadir día"
        variant="secondary"
        onPress={() => setDays((p) => [...p, newDay(p.length + 1)])}
        style={{ marginTop: spacing.sm }}
      />
      <Button
        title={saving ? 'Guardando...' : routineId ? 'Guardar cambios' : 'Crear mi plan'}
        onPress={handleSave}
        loading={saving}
        style={{ marginTop: spacing.md }}
      />
      <Button
        title="Ir a entrenar"
        variant="ghost"
        onPress={() => router.push('/(client)/workout')}
        style={{ marginTop: spacing.sm }}
      />
      <View style={{ height: spacing.xl }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.small, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md },
  dayCard: { marginTop: spacing.md, gap: spacing.sm },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dayName: {
    flex: 1,
    ...typography.h3,
    color: colors.text,
    fontFamily: fonts.semiBold,
    paddingVertical: 4,
  },
  restRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  restLabel: { ...typography.small, color: colors.textMuted },
  exBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  exTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exName: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  exFields: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  field: { gap: 2 },
  fieldLabel: { ...typography.small, color: colors.textFaint, fontSize: 11 },
  fieldInput: {
    width: 64,
    ...typography.body,
    color: colors.text,
    textAlign: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
  },
  measureBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  measureText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  addEx: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.sm },
  addExText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
});
