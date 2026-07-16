/**
 * Calculadora de calorías y macros (misma lógica que la calculadora web de
 * Luistenafit): BMR Mifflin-St Jeor × factor de actividad × factor de objetivo.
 * Proteína 1,35 g/kg, grasas 0,8 g/kg, el resto de kcal en carbohidratos.
 */

export type Sex = 'male' | 'female';
export type Goal = 'cut' | 'maintain' | 'lean' | 'bulk';

export interface ActivityOption {
  value: number;
  label: string;
}

export const ACTIVITY_OPTIONS: ActivityOption[] = [
  { value: 1.2, label: 'Sedentario · poco o ningún ejercicio' },
  { value: 1.375, label: 'Ligero · 1-3 días/semana' },
  { value: 1.55, label: 'Moderado · 3-5 días/semana' },
  { value: 1.725, label: 'Activo · 6-7 días/semana' },
  { value: 1.9, label: 'Muy activo · dobles sesiones o trabajo físico' },
];

export const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: 'cut', label: 'Definición' },
  { value: 'maintain', label: 'Mantenimiento' },
  { value: 'lean', label: 'Volumen limpio' },
  { value: 'bulk', label: 'Volumen agresivo' },
];

const GOAL_MULTIPLIER: Record<Goal, number> = {
  cut: 0.82,
  maintain: 1.0,
  lean: 1.1,
  bulk: 1.18,
};

export interface MacroInput {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activity: number;
  goal: Goal;
}

export interface MacroResult {
  dailyCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** true si los datos son razonables para calcular. */
export function isValidMacroInput(i: Partial<MacroInput>): i is MacroInput {
  return (
    !!i.weightKg && i.weightKg >= 30 &&
    !!i.heightCm && i.heightCm >= 100 &&
    !!i.age && i.age >= 10 &&
    !!i.sex && !!i.activity && !!i.goal
  );
}

export function computeMacros(i: MacroInput): MacroResult {
  const { weightKg: w, heightCm: h, age: a, sex, activity, goal } = i;
  // BMR Mifflin-St Jeor
  const bmr = sex === 'male'
    ? 10 * w + 6.25 * h - 5 * a + 5
    : 10 * w + 6.25 * h - 5 * a - 161;
  const tdee = bmr * activity;
  const dailyCalories = Math.round(tdee * GOAL_MULTIPLIER[goal]);

  const proteinG = Math.round(1.35 * w);
  const fatG = Math.round(0.8 * w);
  const carbKcal = Math.max(0, dailyCalories - proteinG * 4 - fatG * 9);
  const carbsG = Math.round(carbKcal / 4);

  return { dailyCalories, proteinG, carbsG, fatG };
}
