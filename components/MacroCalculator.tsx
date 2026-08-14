import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Button } from './Button';
import { TextField } from './TextField';
import {
  ACTIVITY_OPTIONS,
  GOAL_OPTIONS,
  computeMacros,
  isValidMacroInput,
  type Goal,
  type MacroResult,
  type Sex,
} from '../lib/nutritionCalc';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * Formulario simple para calcular calorías y macros. Muestra el resultado en
 * vivo y, al guardar, lo devuelve por `onDone`. Se usa en el onboarding y en
 * la pestaña de nutrición (recalcular).
 */
export function MacroCalculator({
  onDone,
  initialWeightKg,
  submitLabel = 'Guardar mis macros',
}: {
  onDone: (result: MacroResult, goal: Goal) => void;
  initialWeightKg?: number;
  submitLabel?: string;
}) {
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState(initialWeightKg ? String(initialWeightKg) : '');
  const [activity, setActivity] = useState(1.55);
  const [goal, setGoal] = useState<Goal>('maintain');
  const [error, setError] = useState<string | null>(null);

  const num = (s: string) => Number(s.replace(',', '.'));
  const input = {
    weightKg: num(weight),
    heightCm: num(height),
    age: num(age),
    sex,
    activity,
    goal,
  };
  const valid = isValidMacroInput(input);
  const result = useMemo<MacroResult | null>(
    () => (valid ? computeMacros(input) : null),
    [weight, height, age, sex, activity, goal, valid]
  );

  return (
    <View>
      <Text style={styles.secLabel}>Tus datos</Text>
      <View style={styles.sexRow}>
        {(['male', 'female'] as Sex[]).map((s) => (
          <Pressable
            key={s}
            onPress={() => setSex(s)}
            style={[styles.sexBtn, sex === s && styles.sexBtnOn]}
          >
            <Text style={[styles.sexText, sex === s && styles.sexTextOn]}>
              {s === 'male' ? 'Hombre' : 'Mujer'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Campos apilados: en móvil los tres caben y se ven siempre. */}
      <TextField
        label="Edad"
        placeholder="años"
        keyboardType="numeric"
        value={age}
        onChangeText={setAge}
      />
      <TextField
        label="Altura (cm)"
        placeholder="Ej. 178"
        keyboardType="numeric"
        value={height}
        onChangeText={setHeight}
      />
      <TextField
        label="Peso (kg)"
        placeholder="Ej. 72,5"
        keyboardType="decimal-pad"
        value={weight}
        onChangeText={setWeight}
      />

      <Text style={styles.secLabel}>Nivel de actividad</Text>
      {ACTIVITY_OPTIONS.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => setActivity(opt.value)}
          style={[styles.actRow, activity === opt.value && styles.actRowOn]}
        >
          <View style={[styles.radio, activity === opt.value && styles.radioOn]}>
            {activity === opt.value ? <View style={styles.radioDot} /> : null}
          </View>
          <Text style={[styles.actText, activity === opt.value && styles.actTextOn]}>
            {opt.label}
          </Text>
        </Pressable>
      ))}

      <Text style={styles.secLabel}>Objetivo</Text>
      <View style={styles.goalGrid}>
        {GOAL_OPTIONS.map((g) => (
          <Pressable
            key={g.value}
            onPress={() => setGoal(g.value)}
            style={[styles.goalChip, goal === g.value && styles.goalChipOn]}
          >
            <Text style={[styles.goalText, goal === g.value && styles.goalTextOn]}>
              {g.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {result ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultKcal}>{result.dailyCalories.toLocaleString('es-ES')} kcal/día</Text>
          <View style={styles.resultMacros}>
            <ResultMacro label="Proteína" value={result.proteinG} />
            <ResultMacro label="Carbos" value={result.carbsG} />
            <ResultMacro label="Grasas" value={result.fatG} />
          </View>
        </View>
      ) : (
        <Text style={styles.hint}>Rellena tus datos para ver tus calorías y macros.</Text>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title={submitLabel}
        onPress={() => {
          // Botón SIEMPRE activo: si algo falta, se explica en vez de no hacer nada.
          if (!result) {
            setError(
              'Revisa tus datos: edad (10+), altura en cm (100+) y peso en kg (30+).'
            );
            return;
          }
          setError(null);
          onDone(result, goal);
        }}
        style={{ marginTop: spacing.md }}
      />
    </View>
  );
}

function ResultMacro({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.resultMacro}>
      <Text style={styles.resultMacroValue}>{value}g</Text>
      <Text style={styles.resultMacroLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  secLabel: {
    ...typography.label,
    color: colors.primaryBright,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sexRow: { flexDirection: 'row', gap: spacing.sm },
  sexBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  sexBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  sexText: { ...typography.body, color: colors.textMuted, fontFamily: fonts.semiBold },
  sexTextOn: { color: colors.onPrimary },
  actRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.xs,
  },
  actRowOn: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  actText: { ...typography.small, color: colors.textMuted, flex: 1 },
  actTextOn: { color: colors.text, fontFamily: fonts.semiBold },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  goalChip: {
    width: '48%',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  // El mismo relleno que el resto de la app: elegido se ve elegido.
  goalChipOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  goalText: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  goalTextOn: { color: colors.onPrimary },
  resultCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
  },
  resultKcal: {
    ...typography.h2,
    color: colors.primaryBright,
    fontFamily: fonts.heading,
    marginBottom: spacing.sm,
  },
  resultMacros: { flexDirection: 'row', justifyContent: 'space-around', alignSelf: 'stretch' },
  resultMacro: { alignItems: 'center' },
  resultMacroValue: { ...typography.h3, color: colors.text, fontFamily: fonts.semiBold },
  resultMacroLabel: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  hint: { ...typography.small, color: colors.textFaint, textAlign: 'center', marginTop: spacing.lg },
  error: { ...typography.small, color: colors.danger, textAlign: 'center', marginTop: spacing.sm },
});
