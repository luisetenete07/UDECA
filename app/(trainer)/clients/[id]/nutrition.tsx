import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../../components/Button';
import { LoadingScreen } from '../../../../components/LoadingScreen';
import { MacroSum } from '../../../../components/MacroSum';
import { ScreenHeader } from '../../../../components/ScreenHeader';
import { ScreenContainer } from '../../../../components/ScreenContainer';
import { TextField } from '../../../../components/TextField';
import { useAuth } from '../../../../lib/auth-context';
import {
  createNutritionPlan,
  getActiveNutritionPlanForClient,
  setActiveNutritionPlan,
  updateNutritionPlan,
} from '../../../../lib/firestore/nutrition';
import { getUserProfile } from '../../../../lib/firestore/users';
import { notifyUser } from '../../../../lib/notifications';
import { colors, spacing, typography } from '../../../../lib/theme';

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
  const [clientName, setClientName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    (async () => {
      const existing = await getActiveNutritionPlanForClient(clientId, profile?.uid);
      getUserProfile(clientId)
        .then((p) => setClientName(p?.name ?? ''))
        .catch(() => {});
      if (existing) {
        setPlanId(existing.id);
        setName(existing.name);
        setCalories(String(existing.dailyCalories));
        setProtein(String(existing.proteinG));
        setCarbs(String(existing.carbsG));
        setFat(String(existing.fatG));
        setNotes(existing.notes ?? '');
      } else {
        // Sin plan del coach: se precarga el plan OFICIAL que el alumno
        // calculó en el onboarding, para verlo (y ajustarlo si hace falta).
        const clientProfile = await getUserProfile(clientId).catch(() => null);
        const t = clientProfile?.nutritionTargets;
        if (t) {
          setName('Plan del alumno (onboarding)');
          setCalories(String(t.dailyCalories));
          setProtein(String(t.proteinG));
          setCarbs(String(t.carbsG));
          setFat(String(t.fatG));
        }
      }
      setLoading(false);
    })();
  }, [clientId]);

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
      const data = {
        name: name.trim(),
        dailyCalories,
        proteinG: Number(protein) || 0,
        carbsG: Number(carbs) || 0,
        fatG: Number(fat) || 0,
        notes: notes.trim() || undefined,
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
      <ScreenHeader
        title="Plan nutricional"
        subtitle={clientName ? `Para ${clientName}` : undefined}
      />

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
          containerStyle={styles.smallField}
        />
        <TextField
          label="Carbs (g)"
          keyboardType="numeric"
          value={carbs}
          onChangeText={setCarbs}
          containerStyle={styles.smallField}
        />
        <TextField
          label="Grasas (g)"
          keyboardType="numeric"
          value={fat}
          onChangeText={setFat}
          containerStyle={styles.smallField}
        />
      </View>

      <MacroSum
        calorias={Number(calories) || 0}
        proteina={Number(protein) || 0}
        carbos={Number(carbs) || 0}
        grasas={Number(fat) || 0}
      />

      <TextField
        label="Notas (opcional)"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={4}
        style={styles.textarea}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Guardar plan" onPress={handleSave} loading={saving} style={{ marginBottom: spacing.xl }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  smallField: { flex: 1, minWidth: 0 },
  textarea: { height: 100, textAlignVertical: 'top' },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.sm },
});
