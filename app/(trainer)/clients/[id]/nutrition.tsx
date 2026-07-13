import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../../components/Button';
import { Card } from '../../../../components/Card';
import { LoadingScreen } from '../../../../components/LoadingScreen';
import { ScreenContainer } from '../../../../components/ScreenContainer';
import { TextField } from '../../../../components/TextField';
import { showToast } from '../../../../components/Toast';
import { useAuth } from '../../../../lib/auth-context';
import {
  createNutritionPlan,
  getActiveNutritionPlanForClient,
  setActiveNutritionPlan,
  updateNutritionPlan,
} from '../../../../lib/firestore/nutrition';
import { pickMealPhoto } from '../../../../lib/image';
import { notifyUser } from '../../../../lib/notifications';
import { colors, fonts, radius, spacing, typography } from '../../../../lib/theme';
import type { MealExample } from '../../../../lib/types';

const MEAL_SUGGESTIONS = ['Desayuno', 'Media mañana', 'Comida', 'Merienda', 'Cena', 'Snack'];

export default function NutritionEditorScreen() {
  const { id: clientId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [name, setName] = useState('Plan nutricional');
  const [calories, setCalories] = useState('2000');
  const [protein, setProtein] = useState('150');
  const [carbs, setCarbs] = useState('200');
  const [fat, setFat] = useState('60');
  const [notes, setNotes] = useState('');
  const [meals, setMeals] = useState<MealExample[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      const existing = await getActiveNutritionPlanForClient(clientId, profile?.uid);
      if (existing) {
        setPlanId(existing.id);
        setName(existing.name);
        setCalories(String(existing.dailyCalories));
        setProtein(String(existing.proteinG));
        setCarbs(String(existing.carbsG));
        setFat(String(existing.fatG));
        setNotes(existing.notes ?? '');
        setMeals(existing.mealExamples ?? []);
      }
      setLoading(false);
    })();
  }, [clientId]);

  const handleAddMealPhoto = async () => {
    setUploading(true);
    try {
      const imageURL = await pickMealPhoto();
      if (imageURL) {
        setMeals((prev) => [
          ...prev,
          { id: `${Date.now()}-${prev.length}`, name: '', imageURL },
        ]);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo subir la foto.';
      if (Platform.OS !== 'web') Alert.alert('Foto de comida', message);
      else showToast(message);
    } finally {
      setUploading(false);
    }
  };

  const updateMeal = (id: string, patch: Partial<MealExample>) =>
    setMeals((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const removeMeal = (id: string) => setMeals((prev) => prev.filter((m) => m.id !== id));

  const handleSave = async () => {
    if (!profile || !clientId) return;
    const dailyCalories = Number(calories);
    if (!name.trim() || !dailyCalories) {
      setError('Indica un nombre y las calorías diarias objetivo.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      // Limpia ejemplos sin foto y normaliza nombres vacíos.
      const mealExamples = meals
        .filter((m) => m.imageURL)
        .map((m) => ({
          id: m.id,
          name: m.name.trim() || 'Comida',
          imageURL: m.imageURL,
          description: m.description?.trim() || undefined,
        }));
      const data = {
        name: name.trim(),
        dailyCalories,
        proteinG: Number(protein) || 0,
        carbsG: Number(carbs) || 0,
        fatG: Number(fat) || 0,
        notes: notes.trim() || undefined,
        mealExamples,
      };
      if (planId) {
        await updateNutritionPlan(planId, data);
        await setActiveNutritionPlan(clientId, planId, profile?.uid);
      } else {
        const newId = await createNutritionPlan({
          trainerId: profile.uid,
          clientId,
          active: true,
          ...data,
        });
        await setActiveNutritionPlan(clientId, newId, profile?.uid);
      }
      notifyUser(
        clientId,
        planId ? 'Plan nutricional actualizado' : 'Nuevo plan nutricional',
        `Tu entrenador ha actualizado tu plan: ${name}`
      );
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el plan.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <ScreenContainer>
      <TextField label="Nombre del plan" value={name} onChangeText={setName} />

      <TextField
        label="Calorías diarias (kcal)"
        keyboardType="numeric"
        value={calories}
        onChangeText={setCalories}
      />

      <View style={styles.row}>
        <TextField
          label="Proteína (g)"
          keyboardType="numeric"
          value={protein}
          onChangeText={setProtein}
          style={styles.smallField}
        />
        <TextField
          label="Carbs (g)"
          keyboardType="numeric"
          value={carbs}
          onChangeText={setCarbs}
          style={styles.smallField}
        />
        <TextField
          label="Grasas (g)"
          keyboardType="numeric"
          value={fat}
          onChangeText={setFat}
          style={styles.smallField}
        />
      </View>

      <TextField
        label="Notas (opcional)"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={4}
        style={styles.textarea}
      />

      <Card style={styles.mealsCard}>
        <Text style={styles.mealsTitle}>Fotos de ejemplo de comidas</Text>
        <Text style={styles.mealsHint}>
          Sube una foto por comida (Desayuno, Comida, Cena…) para que tu alumno vea
          qué preparar. Las verá en su pestaña de nutrición.
        </Text>

        {meals.map((meal) => (
          <View key={meal.id} style={styles.mealItem}>
            <Image source={{ uri: meal.imageURL }} style={styles.mealPhoto} resizeMode="cover" />
            <View style={{ flex: 1, gap: spacing.xs }}>
              <TextField
                placeholder="Nombre (Ej. Desayuno)"
                value={meal.name}
                onChangeText={(v) => updateMeal(meal.id, { name: v })}
              />
              <TextField
                placeholder="Descripción (opcional)"
                value={meal.description ?? ''}
                onChangeText={(v) => updateMeal(meal.id, { description: v })}
              />
              <View style={styles.suggestRow}>
                {MEAL_SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => updateMeal(meal.id, { name: s })}
                    style={styles.suggestChip}
                    hitSlop={4}
                  >
                    <Text style={styles.suggestText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={() => removeMeal(meal.id)}
                style={styles.removeBtn}
                hitSlop={6}
              >
                <Ionicons name="trash-outline" size={14} color={colors.danger} />
                <Text style={styles.removeText}>Quitar</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <Button
          title={uploading ? 'Subiendo…' : 'Añadir foto de comida'}
          variant="secondary"
          onPress={handleAddMealPhoto}
          loading={uploading}
          style={{ marginTop: spacing.sm }}
        />
      </Card>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Guardar plan" onPress={handleSave} loading={saving} style={{ marginBottom: spacing.xl }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  smallField: { flex: 1 },
  textarea: { height: 100, textAlignVertical: 'top' },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.sm },
  mealsCard: { marginTop: spacing.md, marginBottom: spacing.md },
  mealsTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  mealsHint: { ...typography.small, color: colors.textFaint, marginBottom: spacing.md, lineHeight: 18 },
  mealItem: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: spacing.sm,
  },
  mealPhoto: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  suggestChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  suggestText: { ...typography.small, color: colors.textMuted, fontSize: 11 },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  removeText: { ...typography.small, color: colors.danger, fontFamily: fonts.semiBold },
});
