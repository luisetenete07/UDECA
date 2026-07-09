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
  /** Recordatorio diario de entrenamiento (hora local, 0-23). */
  reminderHour?: number;
  reminderEnabled?: boolean;
  /** Estado del alumno gestionado por el entrenador. */
  status?: ClientStatus;
  /** Estado de pago del alumno, gestionado por el entrenador. */
  paymentStatus?: PaymentStatus;
  /** Cuota mensual del alumno en euros (la fija el entrenador). */
  monthlyFeeEur?: number;
  /** Fecha (timestamp) del próximo pago / renovación. */
  nextPaymentDate?: number;
  /** Token de Expo Push Notifications del último dispositivo registrado. */
  pushToken?: string;
  /** true en cuentas creadas con verificación de correo obligatoria. */
  emailVerificationRequired?: boolean;
}

export const CLIENT_STATUSES = ['active', 'paused', 'inactive'] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = {
  active: 'Activo',
  paused: 'En pausa',
  inactive: 'Inactivo',
};

/** Estado de pago del alumno, gestionado por el entrenador. */
export const PAYMENT_STATUSES = ['paid', 'pending', 'overdue', 'trial', 'free'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  paid: 'Pagado',
  pending: 'Pago pendiente',
  overdue: 'Vencido',
  trial: 'Prueba',
  free: 'Cortesía',
};

/** Color semántico de cada estado de pago (verde/ámbar/rojo/neutro). */
export const PAYMENT_STATUS_TONE: Record<PaymentStatus, 'good' | 'warn' | 'bad' | 'muted'> = {
  paid: 'good',
  pending: 'warn',
  overdue: 'bad',
  trial: 'muted',
  free: 'muted',
};

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

/** Cómo se mide el ejercicio: repeticiones o segundos (isométricos). */
export type ExerciseMeasure = 'reps' | 'seconds';

/**
 * Carga del ejercicio (calistenia):
 *  - 'none': peso corporal, sin nada extra (dominadas normales).
 *  - 'weighted': lastrado, se añade peso (dominadas lastradas → casilla kg).
 *  - 'assisted': asistido con goma/banda (dominadas asistidas → casilla goma).
 */
export type ExerciseLoad = 'none' | 'weighted' | 'assisted';

/** Deriva la carga admitiendo datos antiguos (band = asistido con goma). */
export function resolveLoad(x: { load?: ExerciseLoad; band?: boolean }): ExerciseLoad {
  if (x.load) return x.load;
  return x.band ? 'assisted' : 'none';
}

export interface Exercise {
  id: string;
  trainerId: string;
  name: string;
  muscleGroup: MuscleGroup;
  description?: string;
  videoUrl?: string;
  /** 'reps' (por defecto) o 'seconds' para isométricos (planchas, L-sit...). */
  measure?: ExerciseMeasure;
  /** Carga: normal / lastrado / asistido con goma. */
  load?: ExerciseLoad;
  /** (Obsoleto) se conserva por compatibilidad; equivale a load='assisted'. */
  band?: boolean;
  createdAt: number;
}

export interface RoutineExercise {
  id: string;
  exerciseId: string;
  name: string;
  sets: number;
  /** Objetivo por serie: repeticiones o segundos según `measure`. */
  reps: string;
  restSeconds?: number;
  notes?: string;
  /** true = se hace en superserie encadenado con el ejercicio anterior. */
  supersetWithPrevious?: boolean;
  /** Copia de la medida del ejercicio al añadirlo ('reps' por defecto). */
  measure?: ExerciseMeasure;
  /** Copia de la carga del ejercicio al añadirlo. */
  load?: ExerciseLoad;
  /** (Obsoleto) copia del uso de goma; equivale a load='assisted'. */
  band?: boolean;
  /** RIR objetivo (repeticiones en reserva), 0-5. */
  rir?: number;
}

export interface RoutineDay {
  id: string;
  name: string;
  /** Día de la semana asignado (0=lunes ... 6=domingo). Sin valor = flexible. */
  weekday?: number;
  /** En el Método REIN TENA (ciclo), marca este día del ciclo como descanso. */
  isRest?: boolean;
  /** Intensidad 1-10 de este entrenamiento (Método REIN TENA), la fija el coach. */
  intensity?: number;
  exercises: RoutineExercise[];
}

/**
 * Cómo se programa una rutina:
 *  - 'weekly': cada día se asigna a un día de la semana (lun/mié/vie...).
 *  - 'cycle' (Método REIN TENA): los días rotan en un ciclo constante
 *    (Día 1 → 2 → 3 → ... → repite) independientemente del día de la semana.
 */
export type RoutineSchedule = 'weekly' | 'cycle';

export const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
export const WEEKDAY_NAMES = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
] as const;

/** Índice de día de la semana con lunes=0 (JS usa domingo=0). */
export function todayWeekday(): number {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

export interface Routine {
  id: string;
  trainerId: string;
  clientId: string;
  name: string;
  active: boolean;
  days: RoutineDay[];
  /** Modo de programación ('weekly' por defecto). */
  schedule?: RoutineSchedule;
  /** Método REIN TENA: fecha (medianoche) en que el ciclo empieza por el Día 1. */
  cycleStartDate?: number;
  /** (Obsoleto) intensidad global; ahora se define por día en RoutineDay. */
  intensity?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Plantilla de rutina reutilizable del entrenador: guarda la estructura de
 * días/ejercicios para aplicarla a cualquier alumno con un toque, sin rehacerla.
 */
export interface RoutineTemplate {
  id: string;
  trainerId: string;
  name: string;
  schedule?: RoutineSchedule;
  cycleStartDate?: number;
  days: RoutineDay[];
  createdAt: number;
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
  /** Cómo se midió (reps o segundos), para mostrar el histórico con su unidad. */
  measure?: ExerciseMeasure;
  /** Carga del ejercicio en su momento (normal/lastrado/asistido). */
  load?: ExerciseLoad;
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
  /** Duración de la sesión en minutos (desde la primera serie completada). */
  durationMin?: number;
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
  /** Sesiones dentro del periodo del reto activo (para el ranking del reto). */
  challengeSessions?: number;
  updatedAt: number;
}

/**
 * Check-in semanal del alumno: pulso subjetivo (energía, sueño, adherencia,
 * sensaciones) que el entrenador revisa en la ficha. Práctica estándar del
 * coaching online serio.
 */
export interface WeeklyCheckIn {
  id: string;
  trainerId: string;
  clientId: string;
  /** Inicio (lunes) de la semana a la que corresponde el check-in. */
  weekStart: number;
  /** Valoraciones de 1 (muy mal) a 5 (excelente). */
  energy: number;
  sleep: number;
  adherence: number;
  soreness: number;
  notes?: string;
  createdAt: number;
}

export const CHECKIN_FIELDS: { key: 'energy' | 'sleep' | 'adherence' | 'soreness'; label: string }[] = [
  { key: 'energy', label: 'Energía' },
  { key: 'sleep', label: 'Sueño' },
  { key: 'adherence', label: 'Dieta y adherencia' },
  { key: 'soreness', label: 'Sensaciones físicas' },
];

/** Anuncio del entrenador para todo su grupo (tablón, no chat). */
export interface Announcement {
  id: string;
  trainerId: string;
  title: string;
  body: string;
  createdAt: number;
}

/**
 * Solicitud de un alumno para unirse al grupo de un entrenador. Se crea al
 * introducir el código; el entrenador la aprueba manualmente (ve nombre,
 * correo y foto). El id es `${clientId}_${trainerId}` (una por par).
 */
export interface JoinRequest {
  id: string;
  trainerId: string;
  clientId: string;
  /** Datos del alumno mostrados al entrenador para decidir. */
  name: string;
  email: string;
  photoURL?: string;
  createdAt: number;
}

/** Hábito diario asignado por el entrenador a un alumno. */
export interface Habit {
  id: string;
  trainerId: string;
  clientId: string;
  name: string;
  createdAt: number;
}

/** Registro de un hábito cumplido en un día concreto (medianoche local). */
export interface HabitLog {
  id: string;
  trainerId: string;
  clientId: string;
  habitId: string;
  /** Día al que corresponde (timestamp a medianoche). */
  day: number;
  createdAt: number;
}

/** Reto del grupo: cuenta sesiones de entrenamiento dentro del periodo. */
export interface Challenge {
  id: string;
  trainerId: string;
  title: string;
  description?: string;
  startDate: number;
  endDate: number;
  active: boolean;
  createdAt: number;
}

export interface Lesson {
  id: string;
  title: string;
  /** URL del vídeo (Firebase Storage, Vimeo privado, etc.). Puede estar vacío. */
  videoUrl?: string;
  durationLabel?: string;
  description?: string;
}

export interface CourseSection {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  trainerId: string;
  title: string;
  description?: string;
  coverURL?: string;
  /** Solo los cursos publicados son visibles para los alumnos. */
  published: boolean;
  sections: CourseSection[];
  createdAt: number;
  updatedAt: number;
}

export type PhotoPose = 'front' | 'side' | 'back';

export const PHOTO_POSES: { key: PhotoPose; label: string }[] = [
  { key: 'front', label: 'Frente' },
  { key: 'side', label: 'Perfil' },
  { key: 'back', label: 'Espalda' },
];

export interface ProgressPhoto {
  id: string;
  trainerId: string;
  clientId: string;
  pose: PhotoPose;
  imageURL: string;
  date: number;
  createdAt: number;
}
