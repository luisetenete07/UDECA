import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/Button';
import { FadeIn } from '../../../components/FadeIn';
import { Card } from '../../../components/Card';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ListSkeleton } from '../../../components/Skeleton';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { TextField } from '../../../components/TextField';
import { useAuth } from '../../../lib/auth-context';
import { isAdmin } from '../../../lib/subscription';
import {
  createExercise,
  deleteExercise,
  getExercisesForTrainer,
} from '../../../lib/firestore/exercises';
import { getTemplateExercises } from '../../../lib/firestore/templateExercises';
import { updateUserProfile } from '../../../lib/firestore/users';
import {
  buildExerciseTemplate,
  parseExerciseTemplate,
  type ExportedExercise,
} from '../../../lib/exerciseTemplateIO';
import { getCached, setCached } from '../../../lib/screenCache';
import { STARTER_LIBRARY } from '../../../lib/starterLibrary';
import { showToast } from '../../../components/Toast';
import { fonts, colors, radius, spacing, typography } from '../../../lib/theme';
import { MUSCLE_GROUPS, type Exercise, type TemplateExercise } from '../../../lib/types';

export default function ExercisesScreen() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  // Pinta al instante lo último conocido (caché de sesión) y refresca detrás.
  const cacheKey = `exercises-${profile?.uid ?? ''}`;
  const [exercises, setExercises] = useState<Exercise[]>(
    () => getCached<Exercise[]>(cacheKey) ?? []
  );
  const [loading, setLoading] = useState(() => getCached(cacheKey) === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [template, setTemplate] = useState<TemplateExercise[]>([]);
  // Import/export de plantillas entre entrenadores.
  const [pendingImport, setPendingImport] = useState<ExportedExercise[] | null>(null);
  const [replacing, setReplacing] = useState(false);
  // Importar por pegado de texto (móvil, donde no hay selector de archivos).
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  // Gestión de categorías del entrenador (Tren superior, Empuje…).
  const [editCats, setEditCats] = useState(false);
  const [newCat, setNewCat] = useState('');

  // Categorías propias del coach (las suyas si las tiene, si no las de por defecto).
  const myCategories = useMemo(
    () =>
      profile?.exerciseCategories && profile.exerciseCategories.length > 0
        ? profile.exerciseCategories
        : [...MUSCLE_GROUPS],
    [profile?.exerciseCategories]
  );

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
    if (myCategories.some((g) => g.toLowerCase() === c.toLowerCase())) {
      showToast('Esa categoría ya existe');
      return;
    }
    setNewCat('');
    saveCategories([...myCategories, c]);
  };
  const removeCategory = (group: string) => {
    const list = myCategories.filter((g) => g !== group);
    if (list.length === 0) {
      showToast('Deja al menos una categoría');
      return;
    }
    if (muscleFilter === group) setMuscleFilter(null);
    saveCategories(list);
  };

  // Pack a precargar: la plantilla oficial de UDECA (editada por el CEO) si
  // existe; si no, el pack estático de calistenia. Cada ejercicio arrastra sus
  // músculos para el cuerpo anatómico.
  const packItems = useMemo(
    () =>
      template.length > 0
        ? template.map((t) => ({
            name: t.name,
            muscleGroup: t.muscleGroup,
            measure: t.measure ?? ('reps' as const),
            description: t.description ?? '',
            videoUrl: t.videoUrl,
            muscles: t.muscles,
          }))
        : STARTER_LIBRARY.map((s) => ({
            name: s.name,
            muscleGroup: s.muscleGroup as string,
            measure: s.measure,
            description: s.description,
            videoUrl: undefined as string | undefined,
            muscles: undefined as import('../../../lib/muscles').MuscleId[] | undefined,
          })),
    [template]
  );

  const missingPack = useMemo(() => {
    const existing = new Set(exercises.map((e) => e.name.trim().toLowerCase()));
    return packItems.filter((p) => !existing.has(p.name.trim().toLowerCase()));
  }, [packItems, exercises]);

  // Importa el pack UDECA saltando los ejercicios que ya existen (por nombre).
  const handleImportPack = async () => {
    if (!profile) return;
    setImporting(true);
    try {
      if (missingPack.length === 0) {
        showToast('Ya tienes todos los ejercicios del pack');
        return;
      }
      await Promise.all(
        missingPack.map((s) =>
          createExercise({
            trainerId: profile.uid,
            name: s.name,
            muscleGroup: s.muscleGroup,
            measure: s.measure,
            description: s.description || undefined,
            videoUrl: s.videoUrl,
            muscles: s.muscles,
          })
        )
      );
      showToast(`${missingPack.length} ejercicios añadidos a tu biblioteca`);
      await load();
    } finally {
      setImporting(false);
    }
  };

  // Exporta la biblioteca actual como archivo JSON (web) o texto (nativo) para
  // pasársela a otro entrenador.
  const handleExport = async () => {
    if (exercises.length === 0) {
      showToast('No tienes ejercicios que exportar');
      return;
    }
    const json = buildExerciseTemplate(exercises);
    const filename = `plantilla-ejercicios-udeca-${new Date().toISOString().slice(0, 10)}.json`;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Plantilla exportada');
    } else {
      try {
        await Share.share({ message: json });
      } catch {
        showToast('No se pudo exportar');
      }
    }
  };

  // Elige un archivo .json en la web y lo lee como texto.
  const pickJsonFile = (): Promise<string | null> =>
    new Promise((resolve) => {
      if (typeof document === 'undefined') return resolve(null);
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => resolve(null);
        reader.readAsText(file);
      };
      input.click();
    });

  const handleImportTemplate = async () => {
    // Móvil: sin selector de archivos, se pega el texto de la plantilla.
    if (Platform.OS !== 'web') {
      setPasteText('');
      setPasteOpen(true);
      return;
    }
    const text = await pickJsonFile();
    if (!text) return;
    const list = parseExerciseTemplate(text);
    if (!list) {
      showToast('El archivo no es una plantilla de ejercicios válida');
      return;
    }
    setPendingImport(list); // abre el aviso de confirmación
  };

  // Confirma el texto pegado (móvil): valida y abre el aviso de sustitución.
  const handlePasteImport = () => {
    const list = parseExerciseTemplate(pasteText);
    if (!list) {
      showToast('El texto no es una plantilla de ejercicios válida');
      return;
    }
    setPasteOpen(false);
    setPendingImport(list);
  };

  // Sustituye TODA la biblioteca por la plantilla importada.
  const confirmReplace = async () => {
    if (!profile || !pendingImport) return;
    setReplacing(true);
    try {
      await Promise.all(exercises.map((e) => deleteExercise(e.id)));
      await Promise.all(
        pendingImport.map((e) =>
          createExercise({
            trainerId: profile.uid,
            name: e.name,
            muscleGroup: e.muscleGroup,
            measure: e.measure,
            description: e.description,
            videoUrl: e.videoUrl,
            muscles: e.muscles,
            load: e.load,
            band: e.band,
          })
        )
      );
      setPendingImport(null);
      await load();
      showToast('Plantilla importada');
    } catch {
      showToast('No se pudo importar la plantilla');
    } finally {
      setReplacing(false);
    }
  };

  const load = useCallback(async () => {
    if (!profile) return;
    const data = await getExercisesForTrainer(profile.uid);
    setExercises(data);
    setCached(cacheKey, data);
    // La plantilla oficial (para precargar). Silenciosa si falla.
    getTemplateExercises()
      .then(setTemplate)
      .catch(() => {});
    setLoading(false);
    setRefreshing(false);
  }, [profile, cacheKey]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(
    () =>
      exercises.filter(
        (e) =>
          e.name.toLowerCase().includes(search.toLowerCase().trim()) &&
          (!muscleFilter || e.muscleGroup === muscleFilter)
      ),
    [exercises, search, muscleFilter]
  );

  // Filtros: las categorías del coach (o las de por defecto) más cualquier otra
  // que ya use algún ejercicio, para no ocultar ninguno.
  const filterCategories = useMemo(() => {
    const base =
      profile?.exerciseCategories && profile.exerciseCategories.length > 0
        ? profile.exerciseCategories
        : [...MUSCLE_GROUPS];
    const extra = exercises.map((e) => e.muscleGroup).filter((g) => g && !base.includes(g));
    return [...base, ...Array.from(new Set(extra))];
  }, [profile?.exerciseCategories, exercises]);

  if (loading) {
    return (
      <ScreenContainer>
        <Text style={styles.title}>Biblioteca</Text>
        <Text style={styles.subtitle}>Cargando ejercicios...</Text>
        <ListSkeleton rows={7} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Biblioteca</Text>
          <Text style={styles.subtitle}>{exercises.length} ejercicio(s)</Text>
        </View>
        <Button title="+ Nuevo" onPress={() => router.push('/(trainer)/exercises/new')} />
      </View>

      {isAdmin(profile) ? (
        <Pressable
          onPress={() => router.push('/(trainer)/exercises/template')}
          style={styles.adminBanner}
        >
          <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.adminBannerTitle}>Plantilla UDECA (CEO)</Text>
            <Text style={styles.adminBannerText}>
              Edita el pack oficial y los músculos de cada ejercicio.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Pressable>
      ) : null}

      <TextField placeholder="Buscar ejercicio..." value={search} onChangeText={setSearch} />

      <View style={styles.catHeader}>
        <Text style={styles.catLabel}>Categorías</Text>
        <Pressable onPress={() => setEditCats((v) => !v)} hitSlop={6}>
          <Text style={styles.catEdit}>{editCats ? 'Listo' : 'Editar categorías'}</Text>
        </Pressable>
      </View>

      {editCats ? (
        <>
          <View style={styles.catWrap}>
            {myCategories.map((group) => (
              <View key={group} style={styles.catChip}>
                <Text style={styles.catChipText}>{group}</Text>
                <Pressable onPress={() => removeCategory(group)} hitSlop={8} style={styles.catX}>
                  <Ionicons name="close-circle" size={16} color={colors.danger} />
                </Pressable>
              </View>
            ))}
          </View>
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
        </>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
          <FilterChip
            label="Todos"
            selected={muscleFilter === null}
            onPress={() => setMuscleFilter(null)}
          />
          {filterCategories.map((group) => (
            <FilterChip
              key={group}
              label={group}
              selected={muscleFilter === group}
              onPress={() => setMuscleFilter(group)}
            />
          ))}
        </ScrollView>
      )}

      {missingPack.length > 0 ? (
        <Button
          title={`Importar pack UDECA (${missingPack.length} ejercicio${
            missingPack.length === 1 ? '' : 's'
          })`}
          variant={exercises.length === 0 ? 'primary' : 'secondary'}
          onPress={handleImportPack}
          loading={importing}
          style={{ marginBottom: spacing.md }}
        />
      ) : null}

      {/* Exportar/importar plantilla entre entrenadores */}
      <View style={styles.toolsRow}>
        <Pressable onPress={handleExport} style={styles.toolBtn} hitSlop={4}>
          <Ionicons name="download-outline" size={16} color={colors.primary} />
          <Text style={styles.toolText}>Exportar plantilla</Text>
        </Pressable>
        <Pressable onPress={handleImportTemplate} style={styles.toolBtn} hitSlop={4}>
          <Ionicons name="cloud-upload-outline" size={16} color={colors.primary} />
          <Text style={styles.toolText}>Importar plantilla</Text>
        </Pressable>
      </View>

      {filtered.length === 0 ? (
        <EmptyState
          title="No hay ejercicios"
          subtitle="Importa el pack UDECA o crea el primero con '+ Nuevo'."
        />
      ) : (
        filtered.map((exercise, index) => (
          <FadeIn key={exercise.id} delay={Math.min(index * 30, 240)}>
          <Pressable onPress={() => router.push(`/(trainer)/exercises/${exercise.id}`)}>
            <Card style={styles.exerciseCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <Text style={styles.exerciseGroup}>{exercise.muscleGroup}</Text>
              </View>
              {exercise.videoUrl ? (
                <View style={styles.videoBadge}>
                  <Ionicons name="play-circle-outline" size={16} color={colors.primary} />
                  <Text style={styles.videoBadgeText}>Vídeo</Text>
                </View>
              ) : null}
            </Card>
          </Pressable>
          </FadeIn>
        ))
      )}

      {/* Importar por pegado de texto (móvil) */}
      <Modal
        visible={pasteOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPasteOpen(false)}
      >
        <View style={styles.confirmBackdrop}>
          <View style={[styles.confirmCard, { alignItems: 'stretch' }]}>
            <Text style={styles.confirmTitle}>Pegar plantilla</Text>
            <Text style={[styles.confirmText, { textAlign: 'left' }]}>
              Pega aquí el texto de la plantilla que te ha compartido otro entrenador.
            </Text>
            <TextInput
              value={pasteText}
              onChangeText={setPasteText}
              placeholder="Pega el contenido JSON…"
              placeholderTextColor={colors.textFaint}
              multiline
              style={styles.pasteInput}
            />
            <Button
              title="Continuar"
              onPress={handlePasteImport}
              style={{ marginTop: spacing.md }}
            />
            <Button
              title="Cancelar"
              variant="ghost"
              onPress={() => setPasteOpen(false)}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </View>
      </Modal>

      {/* Aviso de confirmación al importar (sustituye TODA la biblioteca) */}
      <Modal
        visible={!!pendingImport}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingImport(null)}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Ionicons name="warning-outline" size={26} color={colors.danger} />
            </View>
            <Text style={styles.confirmTitle}>¿Sustituir tu plantilla actual?</Text>
            <Text style={styles.confirmText}>
              Esto borrará tus {exercises.length} ejercicio(s) actuales y los reemplazará por los{' '}
              {pendingImport?.length ?? 0} de la plantilla importada. No se puede deshacer.
            </Text>
            <Button
              title={`Sustituir por ${pendingImport?.length ?? 0} ejercicios`}
              variant="danger"
              onPress={confirmReplace}
              loading={replacing}
              style={{ marginTop: spacing.md }}
            />
            <Button
              title="Cancelar"
              variant="ghost"
              onPress={() => setPendingImport(null)}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  adminBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.primaryMuted,
    marginBottom: spacing.md,
  },
  adminBannerTitle: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  adminBannerText: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  catLabel: { ...typography.label, color: colors.textMuted, textTransform: 'uppercase' },
  catEdit: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
  catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catChipText: { ...typography.small, color: colors.text, fontFamily: fonts.semiBold },
  catX: { marginLeft: -2, marginRight: -4 },
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
  toolsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  toolBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceAlt,
  },
  toolText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold, fontSize: 12 },
  confirmBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
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
    alignItems: 'center',
  },
  confirmIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.dangerMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  confirmTitle: { ...typography.h3, color: colors.text, textAlign: 'center' },
  confirmText: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  pasteInput: {
    marginTop: spacing.md,
    minHeight: 140,
    maxHeight: 240,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 13,
    textAlignVertical: 'top',
  },
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted },
  filters: { marginVertical: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold, },
  chipTextSelected: { color: colors.onPrimary },
  exerciseCard: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  exerciseName: { ...typography.h3, color: colors.text },
  exerciseGroup: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  videoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  videoBadgeText: { ...typography.small, color: colors.primary, fontFamily: fonts.heading, },
});
