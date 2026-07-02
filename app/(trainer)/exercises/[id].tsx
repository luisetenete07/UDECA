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
import { colors, radius, spacing, typography } from '../../../lib/theme';
import { MUSCLE_GROUPS, type MuscleGroup } from '../../../lib/types';

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
        });
      } else if (id) {
        await updateExercise(id, {
          name: name.trim(),
          muscleGroup,
          description: description.trim() || undefined,
          videoUrl: videoUrl.trim() || undefined,
        });
      }
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
  chipText: { ...typography.small, color: colors.textMuted, fontWeight: '600' },
  chipTextSelected: { color: colors.background },
  textarea: { height: 100, textAlignVertical: 'top' },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.sm },
});
