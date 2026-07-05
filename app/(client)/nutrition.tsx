import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { LoadingScreen } from '../../components/LoadingScreen';
import { MacroBar } from '../../components/MacroBar';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../lib/auth-context';
import {
  createMealLog,
  getActiveNutritionPlanForClient,
  getMealLogsForClient,
} from '../../lib/firestore/nutrition';
import { fonts, colors, spacing, typography } from '../../lib/theme';
import type { MealLog, NutritionPlan } from '../../lib/types';

function isToday(timestamp: number) {
  const d = new Date(timestamp);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function NutritionScreen() {
  const { profile } = useAuth();
  const [plan, setPlan] = useState<NutritionPlan | null>(null);
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [mealName, setMealName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const [planData, mealData] = await Promise.all([
      getActiveNutritionPlanForClient(profile.uid),
      getMealLogsForClient(profile.uid),
    ]);
    setPlan(planData);
    setMeals(mealData);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const todayMeals = useMemo(() => meals.filter((m) => isToday(m.date)), [meals]);
  const totals = todayMeals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      proteinG: acc.proteinG + m.proteinG,
      carbsG: acc.carbsG + m.carbsG,
      fatG: acc.fatG + m.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );

  const handleAddMeal = async () => {
    if (!profile || !plan) return;
    const cal = Number(calories) || 0;
    if (!mealName.trim() || cal <= 0) {
      setError('Indica un nombre y las calorías de la comida.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createMealLog({
        trainerId: plan.trainerId,
        clientId: profile.uid,
        date: Date.now(),
        name: mealName.trim(),
        calories: cal,
        proteinG: Number(protein) || 0,
        carbsG: Number(carbs) || 0,
        fatG: Number(fat) || 0,
      });
      setMealName('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen />;

  if (!plan) {
    return (
      <ScreenContainer>
        <Text style={styles.title}>Mi nutrición</Text>
        <EmptyState
          title="Sin plan nutricional"
          subtitle="Tu entrenador todavía no te ha asignado un plan de nutrición."
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Mi nutrición</Text>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Hoy</Text>
        <MacroBar label="Calorías" consumed={totals.calories} target={plan.dailyCalories} unit="kcal" />
        <MacroBar label="Proteína" consumed={totals.proteinG} target={plan.proteinG} unit="g" />
        <MacroBar label="Carbohidratos" consumed={totals.carbsG} target={plan.carbsG} unit="g" />
        <MacroBar label="Grasas" consumed={totals.fatG} target={plan.fatG} unit="g" />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Registrar comida</Text>
        <TextField placeholder="Ej. Desayuno" value={mealName} onChangeText={setMealName} />
        <View style={styles.row}>
          <TextField
            placeholder="Kcal"
            keyboardType="numeric"
            value={calories}
            onChangeText={setCalories}
            style={styles.smallField}
          />
          <TextField
            placeholder="Prot. (g)"
            keyboardType="numeric"
            value={protein}
            onChangeText={setProtein}
            style={styles.smallField}
          />
        </View>
        <View style={styles.row}>
          <TextField
            placeholder="Carbs (g)"
            keyboardType="numeric"
            value={carbs}
            onChangeText={setCarbs}
            style={styles.smallField}
          />
          <TextField
            placeholder="Grasas (g)"
            keyboardType="numeric"
            value={fat}
            onChangeText={setFat}
            style={styles.smallField}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Añadir comida" onPress={handleAddMeal} loading={saving} />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Comidas de hoy</Text>
        {todayMeals.length === 0 ? (
          <Text style={styles.mutedText}>Todavía no has registrado comidas hoy.</Text>
        ) : (
          todayMeals.map((meal) => (
            <View key={meal.id} style={styles.mealRow}>
              <Text style={styles.mealName}>{meal.name}</Text>
              <Text style={styles.mealMacros}>
                {meal.calories} kcal · P{meal.proteinG} C{meal.carbsG} G{meal.fatG}
              </Text>
            </View>
          ))
        )}
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.lg },
  section: { marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  smallField: { flex: 1 },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.sm },
  mutedText: { ...typography.small, color: colors.textFaint },
  mealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  mealName: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, },
  mealMacros: { ...typography.small, color: colors.textMuted },
});
