import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { TextField } from '../../../components/TextField';
import { useAuth } from '../../../lib/auth-context';
import { getExercisesForTrainer } from '../../../lib/firestore/exercises';
import { getCached, setCached } from '../../../lib/screenCache';
import { fonts, colors, radius, spacing, typography } from '../../../lib/theme';
import { MUSCLE_GROUPS, type Exercise } from '../../../lib/types';

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

  const load = useCallback(async () => {
    if (!profile) return;
    const data = await getExercisesForTrainer(profile.uid);
    setExercises(data);
    setCached(cacheKey, data);
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

  if (loading) return <LoadingScreen />;

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

      <TextField placeholder="Buscar ejercicio..." value={search} onChangeText={setSearch} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
        <FilterChip
          label="Todos"
          selected={muscleFilter === null}
          onPress={() => setMuscleFilter(null)}
        />
        {MUSCLE_GROUPS.map((group) => (
          <FilterChip
            key={group}
            label={group}
            selected={muscleFilter === group}
            onPress={() => setMuscleFilter(group)}
          />
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <EmptyState
          title="No hay ejercicios"
          subtitle="Crea tu primer ejercicio con el botón '+ Nuevo'."
        />
      ) : (
        filtered.map((exercise) => (
          <Pressable
            key={exercise.id}
            onPress={() => router.push(`/(trainer)/exercises/${exercise.id}`)}
          >
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
        ))
      )}
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
