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
import { ListaRadio } from '../../../components/ListaRadio';
import { Chip } from '../../../components/Chip';
import { colors, fieldLabel, fonts, radius, spacing, typography } from '../../../lib/theme';
import {
  EXERCISE_MEASURES,
  MEASURE_LABEL,
  MEASURE_SHORT,
  MUSCLE_GROUPS,
  type ExerciseMeasure,
  type TemplateExercise,
} from '../../../lib/types';

/** Redondea un porcentaje al escalón más cercano de 25 (mínimo 25 si > 0). */
function snapPct(p: number): number {
  const s = Math.round(p / 25) * 25;
  return Math.min(100, Math.max(p > 0 ? 25 : 0, s));
}

/** Pesos por defecto de un ejercicio del pack base (clasificador por nombre). */
function defaultWeights(name: string, group: string): Partial<Record<MuscleId, number>> {
  const w = musclesForExercise(name, group);
  const out: Partial<Record<MuscleId, number>> = {};
  for (const [m, v] of Object.entries(w) as [MuscleId, number][]) {
    if (v >= 0.4) out[m] = snapPct(v * 100);
  }
  return out;
}

/** Lista de músculos activos (peso > 0) de un mapa de pesos. */
function musclesOf(weights: Partial<Record<MuscleId, number>>): MuscleId[] {
  return (Object.entries(weights) as [MuscleId, number][])
    .filter(([, v]) => v > 0)
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
  /** Porcentaje de trabajo por músculo (0 = no trabaja, 25/50/75/100). */
  muscleWeights: Partial<Record<MuscleId, number>>;
  subgroup: string;
}

const EMPTY_DRAFT: Draft = {
  name: '',
  muscleGroup: MUSCLE_GROUPS[0],
  measure: 'reps',
  description: '',
  videoUrl: '',
  muscleWeights: {},
  subgroup: '',
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
      // Datos antiguos sin porcentajes: cada músculo marcado cuenta al 100 %.
      muscleWeights:
        it.muscleWeights ??
        Object.fromEntries((it.muscles ?? []).map((m) => [m, 100])),
      subgroup: it.subgroup ?? '',
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
      // La plantilla UDECA nunca guarda vídeo: cada entrenador pone el suyo.
      videoUrl: undefined,
      muscles: musclesOf(draft.muscleWeights).length > 0 ? musclesOf(draft.muscleWeights) : undefined,
      muscleWeights:
        musclesOf(draft.muscleWeights).length > 0 ? draft.muscleWeights : undefined,
      subgroup: draft.subgroup.trim() || undefined,
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
          muscles: musclesOf(defaultWeights(s.name, s.muscleGroup)),
          muscleWeights: defaultWeights(s.name, s.muscleGroup),
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
          // Nunca copiamos el vídeo del coach a la plantilla oficial.
          videoUrl: undefined,
          muscles: e.muscles,
          muscleWeights: e.muscleWeights,
          subgroup: e.subgroup,
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
            {items.length} {items.length === 1 ? 'ejercicio' : 'ejercicios'} · precarga oficial
            para entrenadores
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
                      {MEASURE_SHORT[it.measure ?? 'reps']}
                      {it.subgroup ? ` · ${it.subgroup}` : ''}
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
                      <Chip
                        key={g}
                        texto={g}
                        activo={draft.muscleGroup === g}
                        onPress={() => setDraft({ ...draft, muscleGroup: g })}
                      />
                    ))}
                  </ScrollView>

                  <Text style={styles.label}>Se mide en</Text>
                  {/* En lista: con cinco medidas, en fila las etiquetas se
                      recortan y "Reps por lado" pasa a ser ilegible. */}
                  <ListaRadio
                    opciones={EXERCISE_MEASURES.map((m) => ({
                      valor: m,
                      texto: MEASURE_LABEL[m],
                    }))}
                    valor={draft.measure}
                    onChange={(measure) => setDraft({ ...draft, measure })}
                  />

                  <TextField
                    label="Subgrupo (opcional)"
                    value={draft.subgroup}
                    onChangeText={(v) => setDraft({ ...draft, subgroup: v })}
                    placeholder="Ej. Accesorios, Flexiones, Press, Aguantes"
                  />

                  <View style={styles.musclesHead}>
                    <Text style={styles.label}>Músculos que trabaja</Text>
                    <Text style={styles.musclesHint}>
                      Toca para subir el % (0 → 25 → 50 → 75 → 100)
                    </Text>
                  </View>
                  <View style={styles.muscleGrid}>
                    {MUSCLE_IDS.map((m) => {
                      const pct = draft.muscleWeights[m] ?? 0;
                      // El chip se tiñe como el cuerpo anatómico: transparente
                      // a 0 % y rojo intenso a 100 %.
                      const bg =
                        pct > 0 ? `rgba(240,57,44,${(0.18 + 0.82 * (pct / 100)).toFixed(2)})` : undefined;
                      return (
                        <Pressable
                          key={m}
                          onPress={() =>
                            setDraft({
                              ...draft,
                              muscleWeights: {
                                ...draft.muscleWeights,
                                [m]: pct >= 100 ? 0 : pct + 25,
                              },
                            })
                          }
                          style={[
                            styles.muscleChip,
                            pct > 0 && styles.muscleChipOn,
                            bg ? { backgroundColor: bg, borderColor: bg } : null,
                          ]}
                        >
                          <Text
                            style={[styles.muscleChipText, pct > 0 && styles.muscleChipTextOn]}
                          >
                            {MUSCLE_LABEL[m]}
                            {pct > 0 ? ` ${pct}%` : ''}
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
                  <Text style={styles.videoNote}>
                    La plantilla no lleva vídeo: cada entrenador añadirá el suyo al importarla.
                  </Text>

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
  label: fieldLabel,
  chips: { marginBottom: spacing.md },
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
  videoNote: {
    ...typography.small,
    color: colors.textFaint,
    fontStyle: 'italic',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  sheetBackdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
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
