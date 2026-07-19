import React, { useCallback, useMemo, useState } from 'react';
import { Redirect, useFocusEffect } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { TextField } from '../../../components/TextField';
import { showToast } from '../../../components/Toast';
import { useAuth } from '../../../lib/auth-context';
import { isAdmin } from '../../../lib/subscription';
import {
  createTemplateExercise,
  deleteTemplateExercise,
  getTemplateExercises,
  updateTemplateExercise,
} from '../../../lib/firestore/templateExercises';
import { getExercisesForTrainer } from '../../../lib/firestore/exercises';
import { MUSCLE_LABEL, musclesForExercise, type MuscleId } from '../../../lib/muscles';
import { STARTER_LIBRARY } from '../../../lib/starterLibrary';
import { fonts, colors, radius, spacing, typography } from '../../../lib/theme';
import {
  MUSCLE_GROUPS,
  type ExerciseMeasure,
  type TemplateExercise,
} from '../../../lib/types';

/** Músculos por defecto de un ejercicio del pack base (los de peso ≥ 0,5). */
function defaultMuscles(name: string, group: string): MuscleId[] {
  const w = musclesForExercise(name, group);
  return (Object.entries(w) as [MuscleId, number][])
    .filter(([, v]) => v >= 0.5)
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m);
}

const MUSCLE_IDS = Object.keys(MUSCLE_LABEL) as MuscleId[];

interface Draft {
  id?: string;
  name: string;
  muscleGroup: string;
  measure: ExerciseMeasure;
  description: string;
  videoUrl: string;
  muscles: MuscleId[];
}

const EMPTY_DRAFT: Draft = {
  name: '',
  muscleGroup: MUSCLE_GROUPS[0],
  measure: 'reps',
  description: '',
  videoUrl: '',
  muscles: [],
};

export default function TemplateExercisesScreen() {
  const { profile } = useAuth();
  const [items, setItems] = useState<TemplateExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [addingMine, setAddingMine] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await getTemplateExercises());
    } catch {
      showToast('No se pudo cargar la plantilla');
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const byGroup = useMemo(() => {
    const map = new Map<string, TemplateExercise[]>();
    for (const it of items) {
      const g = it.muscleGroup || 'Otros';
      map.set(g, [...(map.get(g) ?? []), it]);
    }
    return [...map.entries()];
  }, [items]);

  // Solo el admin (CEO) puede entrar aquí.
  if (profile && !isAdmin(profile)) return <Redirect href="/(trainer)/exercises" />;
  if (loading) return <LoadingScreen />;

  const openNew = () => setDraft({ ...EMPTY_DRAFT });
  const openEdit = (it: TemplateExercise) =>
    setDraft({
      id: it.id,
      name: it.name,
      muscleGroup: it.muscleGroup,
      measure: it.measure ?? 'reps',
      description: it.description ?? '',
      videoUrl: it.videoUrl ?? '',
      muscles: it.muscles ?? [],
    });

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      showToast('Pon un nombre al ejercicio');
      return;
    }
    setSaving(true);
    const payload = {
      name: draft.name.trim(),
      muscleGroup: draft.muscleGroup,
      measure: draft.measure,
      description: draft.description.trim() || undefined,
      videoUrl: draft.videoUrl.trim() || undefined,
      muscles: draft.muscles.length > 0 ? draft.muscles : undefined,
    };
    try {
      if (draft.id) {
        await updateTemplateExercise(draft.id, payload);
      } else {
        await createTemplateExercise({ ...payload, order: items.length });
      }
      setDraft(null);
      await load();
      showToast('Ejercicio guardado en la plantilla');
    } catch {
      showToast('No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  // Carga el pack base de calistenia en la plantilla (con músculos por defecto)
  // para que el CEO tenga un punto de partida que editar. Salta los repetidos.
  const seedBasePack = async () => {
    const existing = new Set(items.map((i) => i.name.trim().toLowerCase()));
    const missing = STARTER_LIBRARY.filter((s) => !existing.has(s.name.trim().toLowerCase()));
    if (missing.length === 0) {
      showToast('El pack base ya está cargado');
      return;
    }
    setSeeding(true);
    try {
      let order = items.length;
      for (const s of missing) {
        await createTemplateExercise({
          name: s.name,
          muscleGroup: s.muscleGroup,
          measure: s.measure,
          description: s.description,
          muscles: defaultMuscles(s.name, s.muscleGroup),
          order: order++,
        });
      }
      await load();
      showToast(`${missing.length} ejercicios base cargados`);
    } catch {
      showToast('No se pudo cargar el pack base');
    } finally {
      setSeeding(false);
    }
  };

  // Añade a la plantilla todos los ejercicios de MI cuenta de coach (con sus
  // características actuales), saltando los que ya estén por nombre.
  const addMyCoachExercises = async () => {
    if (!profile) return;
    setAddingMine(true);
    try {
      const mine = await getExercisesForTrainer(profile.uid);
      const existing = new Set(items.map((i) => i.name.trim().toLowerCase()));
      const missing = mine.filter((e) => !existing.has(e.name.trim().toLowerCase()));
      if (missing.length === 0) {
        showToast('Tus ejercicios ya están en la plantilla');
        return;
      }
      let order = items.length;
      for (const e of missing) {
        await createTemplateExercise({
          name: e.name,
          muscleGroup: e.muscleGroup,
          measure: e.measure ?? 'reps',
          description: e.description,
          videoUrl: e.videoUrl,
          muscles: e.muscles,
          order: order++,
        });
      }
      await load();
      showToast(`${missing.length} ejercicios añadidos desde tu cuenta`);
    } catch {
      showToast('No se pudieron añadir');
    } finally {
      setAddingMine(false);
    }
  };

  const remove = async () => {
    if (!draft?.id) return;
    setSaving(true);
    try {
      await deleteTemplateExercise(draft.id);
      setDraft(null);
      await load();
      showToast('Ejercicio eliminado de la plantilla');
    } catch {
      showToast('No se pudo eliminar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Plantilla UDECA</Text>
          <Text style={styles.subtitle}>
            {items.length} ejercicio(s) · precarga oficial para entrenadores
          </Text>
        </View>
        <Button title="+ Nuevo" onPress={openNew} />
      </View>

      <Text style={styles.note}>
        Solo tú (CEO) editas esta plantilla. Cada entrenador nuevo puede precargarla en su
        biblioteca. Elige los músculos de cada ejercicio para el cuerpo anatómico.
      </Text>

      <Button
        title="Añadir mis ejercicios de coach"
        onPress={addMyCoachExercises}
        loading={addingMine}
        style={{ marginBottom: spacing.sm }}
      />

      {STARTER_LIBRARY.some(
        (s) => !items.some((i) => i.name.trim().toLowerCase() === s.name.trim().toLowerCase())
      ) ? (
        <Button
          title="Cargar pack base de calistenia"
          variant="secondary"
          onPress={seedBasePack}
          loading={seeding}
          style={{ marginBottom: spacing.md }}
        />
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon="barbell-outline"
          title="Plantilla vacía"
          subtitle="Carga el pack base o crea el primer ejercicio con '+ Nuevo'."
        />
      ) : (
        byGroup.map(([group, list]) => (
          <View key={group} style={styles.groupBlock}>
            <Text style={styles.groupTitle}>{group}</Text>
            {list.map((it) => (
              <Pressable key={it.id} onPress={() => openEdit(it)}>
                <Card style={styles.itemCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{it.name}</Text>
                    <Text style={styles.itemMeta}>
                      {it.measure === 'seconds' ? 'Isométrico' : 'Repeticiones'}
                      {it.muscles && it.muscles.length > 0
                        ? ` · ${it.muscles.map((m) => MUSCLE_LABEL[m]).join(', ')}`
                        : ' · sin músculos'}
                    </Text>
                  </View>
                  <Ionicons name="create-outline" size={18} color={colors.textFaint} />
                </Card>
              </Pressable>
            ))}
          </View>
        ))
      )}

      <Modal
        visible={!!draft}
        animationType="slide"
        transparent
        onRequestClose={() => setDraft(null)}
      >
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{draft?.id ? 'Editar' : 'Nuevo'} ejercicio</Text>
              <Pressable onPress={() => setDraft(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {draft ? (
                <>
                  <TextField
                    label="Nombre"
                    value={draft.name}
                    onChangeText={(v) => setDraft({ ...draft, name: v })}
                    placeholder="Ej. Dominadas estrictas"
                  />

                  <Text style={styles.label}>Categoría</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
                    {MUSCLE_GROUPS.map((g) => (
                      <Pressable
                        key={g}
                        onPress={() => setDraft({ ...draft, muscleGroup: g })}
                        style={[styles.chip, draft.muscleGroup === g && styles.chipOn]}
                      >
                        <Text
                          style={[styles.chipText, draft.muscleGroup === g && styles.chipTextOn]}
                        >
                          {g}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Text style={styles.label}>Se mide en</Text>
                  <View style={styles.segment}>
                    {(['reps', 'seconds'] as ExerciseMeasure[]).map((m) => (
                      <Pressable
                        key={m}
                        onPress={() => setDraft({ ...draft, measure: m })}
                        style={[styles.segBtn, draft.measure === m && styles.segBtnOn]}
                      >
                        <Text style={[styles.segText, draft.measure === m && styles.segTextOn]}>
                          {m === 'reps' ? 'Repeticiones' : 'Segundos (isométrico)'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <View style={styles.musclesHead}>
                    <Text style={styles.label}>Músculos que trabaja</Text>
                    <Text style={styles.musclesHint}>Para el cuerpo anatómico</Text>
                  </View>
                  <View style={styles.muscleGrid}>
                    {MUSCLE_IDS.map((m) => {
                      const on = draft.muscles.includes(m);
                      return (
                        <Pressable
                          key={m}
                          onPress={() =>
                            setDraft({
                              ...draft,
                              muscles: on
                                ? draft.muscles.filter((x) => x !== m)
                                : [...draft.muscles, m],
                            })
                          }
                          style={[styles.muscleChip, on && styles.muscleChipOn]}
                        >
                          {on ? (
                            <Ionicons name="checkmark" size={13} color={colors.onPrimary} />
                          ) : null}
                          <Text
                            style={[styles.muscleChipText, on && styles.muscleChipTextOn]}
                          >
                            {MUSCLE_LABEL[m]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <TextField
                    label="Descripción / técnica"
                    value={draft.description}
                    onChangeText={(v) => setDraft({ ...draft, description: v })}
                    placeholder="Indicaciones de ejecución..."
                    multiline
                    numberOfLines={4}
                    style={styles.textarea}
                  />
                  <TextField
                    label="URL del vídeo"
                    value={draft.videoUrl}
                    onChangeText={(v) => setDraft({ ...draft, videoUrl: v })}
                    placeholder="https://..."
                    autoCapitalize="none"
                  />

                  <Button
                    title="Guardar"
                    onPress={save}
                    loading={saving}
                    style={{ marginTop: spacing.sm }}
                  />
                  {draft.id ? (
                    <Button
                      title="Eliminar de la plantilla"
                      variant="danger"
                      onPress={remove}
                      style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}
                    />
                  ) : (
                    <View style={{ height: spacing.lg }} />
                  )}
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  note: {
    ...typography.small,
    color: colors.textMuted,
    lineHeight: 19,
    marginBottom: spacing.lg,
  },
  groupBlock: { marginBottom: spacing.md },
  groupTitle: {
    ...typography.label,
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  itemCard: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  itemName: { ...typography.h3, color: colors.text },
  itemMeta: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  label: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  chips: { marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  chipTextOn: { color: colors.onPrimary },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.xs,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  segBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  segBtnOn: { backgroundColor: colors.primary },
  segText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  segTextOn: { color: colors.onPrimary },
  musclesHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  musclesHint: { ...typography.small, color: colors.textFaint, fontSize: 11 },
  muscleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  muscleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  muscleChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  muscleChipText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  muscleChipTextOn: { color: colors.onPrimary },
  textarea: { height: 100, textAlignVertical: 'top' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    maxHeight: '90%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sheetTitle: { ...typography.h3, color: colors.text },
});
