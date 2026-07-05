export type UserRole = 'trainer' | 'client';

export interface UserProfile {
  uid: string;
  role: UserRole;
  name: string;
  email: string;
  createdAt: number;
  /** Solo en entrenadores: código que comparten con sus clientes para vincularse. */
  inviteCode?: string;
  /** Solo en clientes: uid del entrenador al que pertenecen. */
  trainerId?: string;
  /** Solo en clientes: objetivo principal del cliente. */
  goal?: string;
  /** Avatar del usuario como data URL (base64) o URL remota. */
  photoURL?: string;
  /** Breve biografía / presentación del alumno. */
  bio?: string;
  /** Nivel de experiencia del alumno. */
  level?: ExperienceLevel;
  /** Peso objetivo del alumno en kg. */
  targetWeightKg?: number;
  /** Token de Expo Push Notifications del último dispositivo registrado. */
  pushToken?: string;
}

export const EXPERIENCE_LEVELS = ['Principiante', 'Intermedio', 'Avanzado', 'Élite'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const MUSCLE_GROUPS = [
  'Tren superior',
  'Tren inferior',
  'Core',
  'Empuje',
  'Tirón',
  'Full body',
  'Movilidad',
  'Cardio',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export interface Exercise {
  id: string;
  trainerId: string;
  name: string;
  muscleGroup: MuscleGroup;
  description?: string;
  videoUrl?: string;
  createdAt: number;
}

export interface RoutineExercise {
  id: string;
  exerciseId: string;
  name: string;
  sets: number;
  reps: string;
  restSeconds?: number;
  notes?: string;
}

export interface RoutineDay {
  id: string;
  name: string;
  exercises: RoutineExercise[];
}

export interface Routine {
  id: string;
  trainerId: string;
  clientId: string;
  name: string;
  active: boolean;
  days: RoutineDay[];
  createdAt: number;
  updatedAt: number;
}

export interface LoggedSet {
  reps: string;
  weight?: string;
  completed: boolean;
}

export interface LoggedExercise {
  exerciseId: string;
  name: string;
  sets: LoggedSet[];
  notes?: string;
}

export interface WorkoutLog {
  id: string;
  trainerId: string;
  clientId: string;
  routineId: string;
  routineName: string;
  dayName: string;
  date: number;
  exercises: LoggedExercise[];
  feedback?: string;
  createdAt: number;
}

export interface WeightLog {
  id: string;
  trainerId: string;
  clientId: string;
  date: number;
  weightKg: number;
  notes?: string;
  createdAt: number;
}

export interface BodyMeasurement {
  id: string;
  trainerId: string;
  clientId: string;
  date: number;
  chestCm?: number;
  waistCm?: number;
  hipsCm?: number;
  armCm?: number;
  thighCm?: number;
  notes?: string;
  createdAt: number;
}

export interface NutritionPlan {
  id: string;
  trainerId: string;
  clientId: string;
  name: string;
  active: boolean;
  dailyCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MealLog {
  id: string;
  trainerId: string;
  clientId: string;
  date: number;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  notes?: string;
  createdAt: number;
}

/**
 * Documento público (por cliente) con métricas no sensibles para el ranking
 * social del coaching. Se guarda aparte del perfil para no exponer datos
 * privados (email, peso, medidas) al resto de miembros.
 */
export interface SocialStats {
  uid: string;
  trainerId: string;
  name: string;
  photoURL?: string;
  level?: ExperienceLevel;
  currentStreak: number;
  sessionsThisWeek: number;
  totalWorkouts: number;
  updatedAt: number;
}
