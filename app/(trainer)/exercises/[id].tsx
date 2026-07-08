import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/Button';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { TextField } from '../../../components/TextField';
import { useAuth } from '../../../lib/auth-context';
import {
  createExercise,
  deleteExercise,
  getExercise,
  updateExercise,
} from '../../../lib/firestore/exercises';
import { showToast } from '../../../components/Toast';
import { fonts, colors, radius, spacing, typography } from '../../../lib/theme';
import { MUSCLE_GROUPS, type ExerciseMeasure, type MuscleGroup } from '../../../lib/types';

export default function ExerciseEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(MUSCLE_GROUPS[0]);
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [measure, setMeasure] = useState<ExerciseMeasure>('reps');
  const [band, setBand] = useState(false);
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
        setBand(exercise.band ?? false);
      }
      setLoading(false);
    })();
  }, [id, isNew]);

  const handleSave = async () => {
    if (!profile) return;
    if (!name.trim()) {
      setError('El nombre del ejercicio es obligatorio.');
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
          band,
        });
      } else if (id) {
        await updateExercise(id, {
          name: name.trim(),
          muscleGroup,
          description: description.trim() || undefined,
          videoUrl: videoUrl.trim() || undefined,
          measure,
          band,
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
    setSaving(true);
    try {
      await deleteExercise(id);
      router.back();
    } finally {
      setSaving(false);
    }
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

      <Text style={styles.label}>Grupo muscular</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        {MUSCLE_GROUPS.map((group) => (
          <Pressable
            key={group}
            onPress={() => setMuscleGroup(group)}
            style={[styles.chip, muscleGroup === group && styles.chipSelected]}
          >
            <Text style={[styles.chipText, muscleGroup === group && styles.chipTextSelected]}>
              {group}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.label}>Se mide en</Text>
      <View style={styles.segment}>
        <Pressable
          onPress={() => setMeasure('reps')}
          style={[styles.segmentBtn, measure === 'reps' && styles.segmentBtnActive]}
        >
          <Text style={[styles.segmentText, measure === 'reps' && styles.segmentTextActive]}>
            Repeticiones
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMeasure('seconds')}
          style={[styles.segmentBtn, measure === 'seconds' && styles.segmentBtnActive]}
        >
          <Text style={[styles.segmentText, measure === 'seconds' && styles.segmentTextActive]}>
            Segundos (isométrico)
          </Text>
        </Pressable>
      </View>

      <Pressable onPress={() => setBand((b) => !b)} style={styles.bandRow}>
        <View style={[styles.checkbox, band && styles.checkboxOn]}>
          {band ? <Text style={styles.checkboxTick}>✓</Text> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bandLabel}>Con goma (banda elástica)</Text>
          <Text style={styles.bandHint}>Asistencia o resistencia con banda</Text>
        </View>
      </Pressable>

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
        label="URL del vídeo (opcional)"
        value={videoUrl}
        onChangeText={setVideoUrl}
        placeholder="https://..."
        autoCapitalize="none"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Guardar" onPress={handleSave} loading={saving} style={{ marginTop: spacing.sm }} />

      {!isNew ? (
        <Button
          title="Eliminar ejercicio"
          variant="danger"
          onPress={handleDelete}
          style={{ marginTop: spacing.md, marginBottom: spacing.xl }}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  bandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxTick: { color: colors.onPrimary, fontSize: 14, fontFamily: fonts.semiBold },
  bandLabel: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  bandHint: { ...typography.small, color: colors.textMuted },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.sm },
});
