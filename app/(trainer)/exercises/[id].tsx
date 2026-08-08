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
import { Chip, ChipRow } from '../../../components/Chip';
import { Dialogo } from '../../../components/Dialogo';
import { colors, fieldLabel, fonts, radius, spacing, typography } from '../../../lib/theme';
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
      <ChipRow scroll>
        {categories.map((group) => (
          <Chip
            key={group}
            texto={group}
            activo={muscleGroup === group && !editCats}
            onPress={() => !editCats && setMuscleGroup(group)}
            accion={editCats ? 'close-circle' : undefined}
            colorAccion={colors.danger}
            onAccion={() => removeCategory(group)}
          />
        ))}
      </ChipRow>
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
      <ChipRow scroll>
        <Chip texto="Sin subgrupo" activo={subgroup === ''} onPress={() => setSubgroup('')} />
        {subgroups.map((sg) => (
          <Chip
            key={sg}
            texto={sg}
            activo={subgroup === sg}
            onPress={() => setSubgroup(sg)}
            /* Lápiz para renombrarlo sin salir del editor. */
            accion="pencil"
            onAccion={() => {
              setRenameSub(sg);
              setRenameText(sg);
            }}
          />
        ))}
      </ChipRow>
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

      <Dialogo
        visible={confirmarBorrado}
        onClose={() => setConfirmarBorrado(false)}
        icono="trash-outline"
        titulo={`¿Eliminar ${name || 'este ejercicio'}?`}
        texto="Desaparece de tu biblioteca y de las rutinas que lo usen. Los entrenamientos ya registrados con él se quedan como están."
        accion="Eliminar"
        onAccion={handleDelete}
        cargando={saving}
      />

      {/* Renombrar subgrupo (arrastra a todos los ejercicios que lo usan) */}
      <Dialogo
        visible={!!renameSub}
        onClose={() => setRenameSub(null)}
        titulo="Renombrar subgrupo"
        texto={`Se actualizarán también los ejercicios que ya están en «${renameSub ?? ''}».`}
      >
        <TextInput
          value={renameText}
          onChangeText={setRenameText}
          placeholder="Nuevo nombre"
          placeholderTextColor={colors.textFaint}
          style={[styles.addCatInput, { marginTop: spacing.md }]}
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
      </Dialogo>
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
  label: fieldLabel,
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
  textarea: { height: 100, textAlignVertical: 'top' },
  measureHint: {
    ...typography.small,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.sm },
});
