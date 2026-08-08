import React, { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/Button';
import { updateUserProfile } from '../../../lib/firestore/users';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { TextField } from '../../../components/TextField';
import { useAuth } from '../../../lib/auth-context';
import {
  createExercise,
  deleteExercise,
  getExercise,
  getExercisesForTrainer,
  updateExercise,
} from '../../../lib/firestore/exercises';
import { showToast } from '../../../components/Toast';
import { ListaRadio } from '../../../components/ListaRadio';
import { fonts, colors, radius, spacing, typography } from '../../../lib/theme';
import {
  EXERCISE_MEASURES,
  isDualMeasure,
  MEASURE_LABEL,
  MUSCLE_GROUPS,
  type ExerciseMeasure,
  type MuscleGroup,
} from '../../../lib/types';

export default function ExerciseEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const { profile, refreshProfile } = useAuth();

  // Categorías del coach: las suyas si las tiene, si no las de por defecto.
  const categories = useMemo(
    () =>
      profile?.exerciseCategories && profile.exerciseCategories.length > 0
        ? profile.exerciseCategories
        : [...MUSCLE_GROUPS],
    [profile?.exerciseCategories]
  );
  const [editCats, setEditCats] = useState(false);
  const [newCat, setNewCat] = useState('');

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  // Borrar un ejercicio se lleva por delante lo que ya está escrito con él:
  // las rutinas que lo usan y su rastro en el historial. No puede pasar de un
  // toque, y menos con un botón rojo a ancho completo pegado a "Guardar".
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<string>(MUSCLE_GROUPS[0]);
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [measure, setMeasure] = useState<ExerciseMeasure>('reps');
  const [subgroup, setSubgroup] = useState<string>('');
  const [newSub, setNewSub] = useState('');
  // Renombrar un subgrupo ya creado, desde el propio editor del ejercicio.
  const [renameSub, setRenameSub] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [renaming, setRenaming] = useState(false);
  // Nombres ya usados en la biblioteca, para no crear duplicados.
  const [takenNames, setTakenNames] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !id) return;
    (async () => {
      const exercise = await getExercise(id);
      if (exercise) {
        setName(exercise.name);
        setMuscleGroup(exercise.muscleGroup);
        setDescription(exercise.description ?? '');
        setVideoUrl(exercise.videoUrl ?? '');
        setMeasure(exercise.measure ?? 'reps');
        setSubgroup(exercise.subgroup ?? '');
      }
      setLoading(false);
    })();
  }, [id, isNew]);

  // Nombres del resto de la biblioteca (excluye el que se está editando).
  useEffect(() => {
    if (!profile) return;
    getExercisesForTrainer(profile.uid)
      .then((list) =>
        setTakenNames(
          new Set(list.filter((e) => e.id !== id).map((e) => e.name.trim().toLowerCase()))
        )
      )
      .catch(() => {});
  }, [profile, id]);

  const handleSave = async () => {
    if (!profile) return;
    if (!name.trim()) {
      setError('El nombre del ejercicio es obligatorio.');
      return;
    }
    // Un mismo nombre dos veces haría imposible distinguirlos en las rutinas y
    // rompería la sincronización del pack (que empareja por nombre).
    if (takenNames.has(name.trim().toLowerCase())) {
      setError('Ya tienes un ejercicio con ese nombre.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (isNew) {
        await createExercise({
          trainerId: profile.uid,
          name: name.trim(),
          muscleGroup,
          description: description.trim() || undefined,
          videoUrl: videoUrl.trim() || undefined,
          measure,
          subgroup: subgroup || undefined,
        });
      } else if (id) {
        await updateExercise(id, {
          name: name.trim(),
          muscleGroup,
          description: description.trim() || undefined,
          videoUrl: videoUrl.trim() || undefined,
          measure,
          subgroup: subgroup || undefined,
        });
      }
      showToast('Ejercicio guardado');
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isNew || !id) return;
    setConfirmarBorrado(false);
    setSaving(true);
    try {
      await deleteExercise(id);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const saveCategories = async (list: string[]) => {
    if (!profile) return;
    try {
      await updateUserProfile(profile.uid, { exerciseCategories: list });
      await refreshProfile();
    } catch {
      showToast('No se pudieron guardar las categorías');
    }
  };

  const addCategory = () => {
    const c = newCat.trim();
    if (!c) return;
    if (categories.some((g) => g.toLowerCase() === c.toLowerCase())) {
      showToast('Esa categoría ya existe');
      return;
    }
    setNewCat('');
    saveCategories([...categories, c]);
  };

  // Subgrupos definidos por el coach para la categoría seleccionada.
  const subgroups = profile?.categorySubgroups?.[muscleGroup] ?? [];

  /** Crea un subgrupo dentro de la categoría actual y lo deja seleccionado. */
  const addSubgroup = async () => {
    const sg = newSub.trim();
    if (!sg || !profile) return;
    if (subgroups.some((x) => x.toLowerCase() === sg.toLowerCase())) {
      showToast('Ese subgrupo ya existe');
      return;
    }
    setNewSub('');
    setSubgroup(sg);
    try {
      await updateUserProfile(profile.uid, {
        categorySubgroups: {
          ...(profile.categorySubgroups ?? {}),
          [muscleGroup]: [...subgroups, sg],
        },
      });
      await refreshProfile();
    } catch {
      showToast('No se pudo crear el subgrupo');
    }
  };

  /**
   * Renombra un subgrupo de la categoría actual. El nombre vive en dos sitios:
   * la lista del perfil y el campo `subgroup` de cada ejercicio que lo usa, así
   * que hay que tocar los dos o esos ejercicios quedan huérfanos.
   */
  const applyRenameSub = async () => {
    if (!profile || !renameSub) return;
    const to = renameText.trim();
    if (!to) return;
    if (to === renameSub) {
      setRenameSub(null);
      return;
    }
    if (subgroups.some((x) => x.toLowerCase() === to.toLowerCase())) {
      showToast('Ya existe un subgrupo con ese nombre');
      return;
    }
    setRenaming(true);
    try {
      const library = await getExercisesForTrainer(profile.uid);
      const affected = library.filter(
        (e) => e.muscleGroup === muscleGroup && e.subgroup === renameSub
      );
      await Promise.all(affected.map((e) => updateExercise(e.id, { subgroup: to })));
      await updateUserProfile(profile.uid, {
        categorySubgroups: {
          ...(profile.categorySubgroups ?? {}),
          [muscleGroup]: subgroups.map((x) => (x === renameSub ? to : x)),
        },
      });
      await refreshProfile();
      // Si el ejercicio abierto estaba en ese subgrupo, sigue en él.
      if (subgroup === renameSub) setSubgroup(to);
      setRenameSub(null);
      showToast('Subgrupo renombrado');
    } catch {
      showToast('No se pudo renombrar el subgrupo');
    } finally {
      setRenaming(false);
    }
  };

  const removeCategory = (group: string) => {
    const list = categories.filter((g) => g !== group);
    if (list.length === 0) {
      showToast('Deja al menos una categoría');
      return;
    }
    if (muscleGroup === group) setMuscleGroup(list[0]);
    saveCategories(list);
  };

  if (loading) return <LoadingScreen />;

  return (
    <ScreenContainer>
      <TextField
        label="Nombre del ejercicio"
        value={name}
        onChangeText={setName}
        placeholder="Ej. Dominadas estrictas"
      />

      <View style={styles.catHeader}>
        <Text style={styles.label}>Categoría</Text>
        <Pressable onPress={() => setEditCats((v) => !v)} hitSlop={6}>
          <Text style={styles.catEdit}>{editCats ? 'Listo' : 'Editar categorías'}</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        {categories.map((group) => (
          <Pressable
            key={group}
            onPress={() => !editCats && setMuscleGroup(group)}
            style={[styles.chip, muscleGroup === group && !editCats && styles.chipSelected]}
          >
            <Text style={[styles.chipText, muscleGroup === group && !editCats && styles.chipTextSelected]}>
              {group}
            </Text>
            {editCats ? (
              <Pressable onPress={() => removeCategory(group)} hitSlop={8} style={styles.chipX}>
                <Ionicons name="close-circle" size={16} color={colors.danger} />
              </Pressable>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
      {editCats ? (
        <View style={styles.addCatRow}>
          <TextInput
            value={newCat}
            onChangeText={setNewCat}
            placeholder="Nueva categoría…"
            placeholderTextColor={colors.textFaint}
            style={styles.addCatInput}
            onSubmitEditing={addCategory}
            returnKeyType="done"
          />
          <Pressable onPress={addCategory} style={styles.addCatBtn} hitSlop={6}>
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={styles.addCatText}>Añadir</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.label}>Subgrupo</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        <Pressable
          onPress={() => setSubgroup('')}
          style={[styles.chip, subgroup === '' && styles.chipSelected]}
        >
          <Text style={[styles.chipText, subgroup === '' && styles.chipTextSelected]}>
            Sin subgrupo
          </Text>
        </Pressable>
        {subgroups.map((sg) => (
          <Pressable
            key={sg}
            onPress={() => setSubgroup(sg)}
            style={[styles.chip, subgroup === sg && styles.chipSelected]}
          >
            <Text style={[styles.chipText, subgroup === sg && styles.chipTextSelected]}>{sg}</Text>
            {/* Lápiz para renombrarlo sin salir del editor. */}
            <Pressable
              onPress={() => {
                setRenameSub(sg);
                setRenameText(sg);
              }}
              hitSlop={8}
              style={styles.chipPencil}
            >
              <Ionicons
                name="pencil"
                size={12}
                color={subgroup === sg ? colors.onPrimary : colors.textMuted}
              />
            </Pressable>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.addCatRow}>
        <TextInput
          value={newSub}
          onChangeText={setNewSub}
          placeholder={`Nuevo subgrupo de ${muscleGroup}…`}
          placeholderTextColor={colors.textFaint}
          style={styles.addCatInput}
          onSubmitEditing={addSubgroup}
          returnKeyType="done"
        />
        <Pressable onPress={addSubgroup} style={styles.addCatBtn} hitSlop={6}>
          <Ionicons name="add" size={16} color={colors.primary} />
          <Text style={styles.addCatText}>Añadir</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Se mide en</Text>
      {/* Lista vertical y no una fila de botones: con cinco opciones, cada
          etiqueta necesita leerse entera ("Aguante por lado" no se distingue
          de "Aguante" recortado a dos palabras). */}
      <ListaRadio
        opciones={EXERCISE_MEASURES.map((m) => ({ valor: m, texto: MEASURE_LABEL[m] }))}
        valor={measure}
        onChange={setMeasure}
      />
      {measure === 'combo' ? (
        <Text style={styles.measureHint}>
          Cada serie combina repeticiones y aguante en una sola tarjeta. Ej.: Muscle
          Up + Front Lever → 5 repeticiones y 12 s.
        </Text>
      ) : isDualMeasure(measure) ? (
        <Text style={styles.measureHint}>
          Cada serie se anota por separado para el lado izquierdo y el derecho. Para
          trabajo a un brazo, donde saber cuál va por detrás es justo el dato que
          importa.
        </Text>
      ) : null}

      <TextField
        label="Descripción / técnica"
        value={description}
        onChangeText={setDescription}
        placeholder="Indicaciones de ejecución..."
        multiline
        numberOfLines={4}
        style={styles.textarea}
      />

      <TextField
        label="URL del vídeo"
        value={videoUrl}
        onChangeText={setVideoUrl}
        placeholder="https://..."
        autoCapitalize="none"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Guardar" onPress={handleSave} loading={saving} style={{ marginTop: spacing.sm }} />

      {!isNew ? (
        <Pressable
          onPress={() => setConfirmarBorrado(true)}
          style={styles.borrarEnlace}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={14} color={colors.textFaint} />
          <Text style={styles.borrarEnlaceTexto}>Eliminar ejercicio</Text>
        </Pressable>
      ) : null}

      <Modal
        visible={confirmarBorrado}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmarBorrado(false)}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>¿Eliminar {name || 'este ejercicio'}?</Text>
            <Text style={styles.confirmText}>
              Desaparece de tu biblioteca y de las rutinas que lo usen. Los
              entrenamientos ya registrados con él se quedan como están.
            </Text>
            <Button
              title="Eliminar"
              variant="danger"
              onPress={handleDelete}
              loading={saving}
              style={{ marginTop: spacing.md }}
            />
            <Button
              title="Cancelar"
              variant="ghost"
              onPress={() => setConfirmarBorrado(false)}
              style={{ marginTop: spacing.xs }}
            />
          </View>
        </View>
      </Modal>

      {/* Renombrar subgrupo (arrastra a todos los ejercicios que lo usan) */}
      <Modal
        visible={!!renameSub}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameSub(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Renombrar subgrupo</Text>
            <Text style={styles.modalText}>
              Se actualizarán también los ejercicios que ya están en «{renameSub}».
            </Text>
            <TextInput
              value={renameText}
              onChangeText={setRenameText}
              placeholder="Nuevo nombre"
              placeholderTextColor={colors.textFaint}
              style={styles.addCatInput}
              onSubmitEditing={applyRenameSub}
              returnKeyType="done"
              autoFocus
            />
            <Button
              title="Guardar"
              onPress={applyRenameSub}
              loading={renaming}
              style={{ marginTop: spacing.md }}
            />
            <Button
              title="Cancelar"
              variant="ghost"
              onPress={() => setRenameSub(null)}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  borrarEnlace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    paddingVertical: spacing.sm,
  },
  borrarEnlaceTexto: { ...typography.small, color: colors.textFaint },
  confirmBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.scrim,
    padding: spacing.lg,
  },
  confirmCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 420,
  },
  confirmTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  confirmText: { ...typography.small, color: colors.textMuted, lineHeight: 19 },
  label: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  chips: { marginBottom: spacing.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  chipX: { marginLeft: -2, marginRight: -4 },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  catEdit: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  addCatRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  addCatInput: {
    flex: 1,
    minHeight: 44,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  addCatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.primaryMuted,
  },
  addCatText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold, },
  chipTextSelected: { color: colors.onPrimary },
  textarea: { height: 100, textAlignVertical: 'top' },
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
  segmentBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  segmentBtnActive: { backgroundColor: colors.primary },
  segmentText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  segmentTextActive: { color: colors.onPrimary },
  measureHint: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  chipPencil: { marginLeft: -1, marginRight: -3, opacity: 0.8 },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.scrim,
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  modalText: {
    ...typography.small,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.sm },
});
