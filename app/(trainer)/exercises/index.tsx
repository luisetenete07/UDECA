import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
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
  const { profile } = useAuth();
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
    if (Platform.OS !== 'web') {
      showToast('Importar plantillas está disponible en la versión web');
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
