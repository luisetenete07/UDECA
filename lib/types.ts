import type { MuscleId } from './muscles';

// 'athlete' = usuario individual que se autoentrena (es su propio coach:
// crea sus rutinas, sigue su progreso y nutrición). De pago mensual.
export type UserRole = 'trainer' | 'client' | 'athlete';

export interface UserProfile {
  uid: string;
  role: UserRole;
  name: string;
  email: string;
  createdAt: number;
  /** Última vez que el alumno cambió su nombre (límite: 1 vez cada 30 días). */
  nameChangedAt?: number;
  /** Solo entrenadores: categorías propias de ejercicios (crea/borra las suyas).
   * Sin valor = usa las de por defecto (MUSCLE_GROUPS). */
  exerciseCategories?: string[];
  /** Color elegido por el entrenador para cada categoría (nombre → color). */
  categoryColors?: Record<string, string>;
  /**
   * Subgrupos dentro de cada categoría, en su orden (categoría → subgrupos).
   * Sirven para separar ejercicios afines: en "Planche", por ejemplo,
   * "Accesorios", "Flexiones", "Press" y "Aguantes".
   */
  categorySubgroups?: Record<string, string[]>;
  /** Solo en entrenadores: código que comparten con sus clientes para vincularse. */
  inviteCode?: string;
  /**
   * Solo en entrenadores: enlace de cobro (Stripe Payment Link, Bizum, PayPal.me…)
   * que sus alumnos abren para pagar la cuota con un toque desde el aviso de cobro.
   */
  paymentLink?: string;
  /** Solo en clientes: uid del entrenador al que pertenecen. */
  trainerId?: string;
  /** Stripe: id de cliente y de suscripción (los escribe el webhook). */
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  /** Solo en coaches con Connect: id de su cuenta conectada de Stripe. */
  stripeAccountId?: string;
  /** true cuando su cuenta de Stripe Connect ya puede recibir cobros. */
  stripeChargesEnabled?: boolean;
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
  /**
   * Solo en clientes: momento en que el alumno declaró "ya he pagado" (pendiente
   * de que el entrenador lo confirme). Se limpia al registrar el cobro.
   */
  paymentReportedAt?: number;
  /** Recordatorio diario de entrenamiento (hora local, 0-23). */
  reminderHour?: number;
  /** Minuto del recordatorio (0-59). */
  reminderMinute?: number;
  reminderEnabled?: boolean;
  /** Recordatorio semanal del check-in (domingos). */
  checkinReminderEnabled?: boolean;
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
  /**
   * SaaS UDECA (solo coaches): fin de la suscripción o del periodo de prueba
   * (timestamp ms). Sin valor = cuenta fundadora (acceso completo, anterior a
   * la monetización). Solo el admin de UDECA puede modificarlo (reglas).
   */
  subscriptionUntil?: number;
  /**
   * Fin de la prueba gratuita fijado al crear la cuenta. Sirve para distinguir
   * "está probando" de "ha pagado": al pagar, subscriptionUntil supera esta
   * fecha. No se vuelve a tocar, así que la prueba no se puede repetir.
   */
  trialEndsAt?: number;
  /**
   * Marcas del último aviso automático enviado por la tarea diaria del
   * servidor (inactividad y cuota). Evitan repetir el mismo recordatorio a
   * diario. Solo las escribe el backend.
   */
  lastInactivityNudge?: number;
  lastPaymentNudge?: number;
  /** Plan contratado. De momento solo existe el anual (180 €/año). */
  subscriptionPlan?: 'annual';
  /** Onboarding completado (una vez por cuenta, sincronizado entre dispositivos). */
  onboardingCompleted?: boolean;
  /**
   * Objetivo de macros que el propio alumno calculó (en el onboarding o en la
   * calculadora): se usa en Nutrición si su coach aún no le asignó un plan.
   */
  nutritionTargets?: {
    dailyCalories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    goal?: string;
    updatedAt: number;
  };
  /**
   * Sesión de entrenamiento en curso, para sincronizar entre dispositivos de la
   * misma cuenta (series, reps, marcas). Se limpia al terminar o descartar.
   */
  activeSession?: ActiveSession;
  /**
   * Ancla del ciclo (Método REIN TENA) por rutina: routineId → timestamp del
   * Día 1. Sincroniza el día del ciclo entre dispositivos.
   */
  cycleAnchors?: Record<string, number>;
  /**
   * Modo Sensaciones: días (timestamp a medianoche) que el alumno marcó como
   * descanso a propósito; no rompen la racha.
   */
  flexRestDays?: number[];
}

/** Sesión de entrenamiento a medias, sincronizable entre dispositivos. */
export interface ActiveSession {
  routineId: string;
  dayId: string;
  log: LoggedExercise[];
  startedAt: number | null;
  savedAt: number;
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
/**
 * Cómo se mide un ejercicio:
 *  - 'reps': repeticiones (dominadas).
 *  - 'seconds': isométrico, se aguanta (front lever).
 *  - 'combo': ambas en la MISMA serie (muscle up + front lever): se apuntan
 *    las repeticiones y, a continuación, el aguante.
 */
/**
 * Paleta con la que cada entrenador colorea sus categorías. Son tonos que
 * conviven con el negro y el oro de UDECA sin competir con ellos.
 */
export const CATEGORY_PALETTE = [
  '#A2968B',
  '#4CAF7D',
  '#3F8EDC',
  '#8E6FD8',
  '#E0A43B',
  '#E2703A',
  '#D2422F',
  '#6B7078',
] as const;

export type ExerciseMeasure = 'reps' | 'seconds' | 'combo';

export const EXERCISE_MEASURES: ExerciseMeasure[] = ['reps', 'seconds', 'combo'];

/** Etiqueta larga (formularios donde se elige la medida). */
export const MEASURE_LABEL: Record<ExerciseMeasure, string> = {
  reps: 'Repeticiones',
  seconds: 'Segundos (isométrico)',
  combo: 'Combo',
};

/** Etiqueta corta (listados y resúmenes). */
export const MEASURE_SHORT: Record<ExerciseMeasure, string> = {
  reps: 'Repeticiones',
  seconds: 'Isométrico',
  combo: 'Combo',
};

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
  /** Categoría del ejercicio. Por defecto una de MUSCLE_GROUPS, pero el coach
   * puede crear las suyas propias, así que es texto libre. */
  muscleGroup: string;
  description?: string;
  videoUrl?: string;
  /** 'reps' (por defecto) o 'seconds' para isométricos (planchas, L-sit...). */
  measure?: ExerciseMeasure;
  /** Carga: normal / lastrado / asistido con goma. */
  load?: ExerciseLoad;
  /** (Obsoleto) se conserva por compatibilidad; equivale a load='assisted'. */
  band?: boolean;
  /**
   * Músculos que trabaja el ejercicio (para colorear el cuerpo anatómico). Si
   * está definido, tiene prioridad sobre la clasificación automática por nombre.
   * Se hereda de la plantilla UDECA al importar el pack.
   */
  muscles?: MuscleId[];
  /**
   * Cuánto trabaja cada músculo, en porcentaje (25/50/75/100). Lo fija el
   * admin en la plantilla y viaja con el pack; el cuerpo anatómico colorea de
   * transparente a rojo intenso según este valor. Si falta, cada músculo de
   * `muscles` cuenta al 100 % (comportamiento anterior).
   */
  muscleWeights?: Partial<Record<MuscleId, number>>;
  /** Subgrupo dentro de su categoría (opcional). */
  subgroup?: string;
  createdAt: number;
}

/**
 * Plantilla maestra de ejercicios de UDECA. La edita SOLO el admin (CEO) y
 * cualquier entrenador nuevo puede precargarla en su biblioteca. Cada ejercicio
 * define qué músculos trabaja para el gráfico del cuerpo anatómico.
 */
export interface TemplateExercise {
  id: string;
  name: string;
  /** Categoría (una de MUSCLE_GROUPS o libre). */
  muscleGroup: string;
  description?: string;
  videoUrl?: string;
  measure?: ExerciseMeasure;
  /** Músculos que trabaja (alimenta el cuerpo anatómico). */
  muscles?: MuscleId[];
  /** Porcentaje de trabajo por músculo (25/50/75/100); ver Exercise. */
  muscleWeights?: Partial<Record<MuscleId, number>>;
  /** Subgrupo dentro de su categoría (viaja con el pack). */
  subgroup?: string;
  /** Orden de aparición en la lista (menor primero). */
  order?: number;
  createdAt: number;
  updatedAt: number;
}

export interface RoutineExercise {
  id: string;
  exerciseId: string;
  name: string;
  sets: number;
  /** Objetivo por serie: repeticiones o segundos según `measure`. */
  reps: string;
  /**
   * Aguante objetivo por serie, en segundos. Solo lo usan los ejercicios
   * 'combo', donde `reps` marca las repeticiones y esto el isométrico.
   */
  seconds?: string;
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
  /**
   * Objetivo del coach para este ejercicio (opcional): reps o segundos a
   * alcanzar según su medida (p. ej. "20" reps o "60" seg de aguante).
   */
  goal?: string;
}

export interface RoutineDay {
  id: string;
  name: string;
  /** Día de la semana asignado (0=lunes ... 6=domingo). Sin valor = flexible. */
  weekday?: number;
  /** En el Método REIN TENA (ciclo), marca este día del ciclo como descanso. */
  isRest?: boolean;
  /**
   * Método REIN TENA: descanso OPCIONAL (p. ej. el Día 7). El alumno decide
   * cada vez: descansar ese día o reiniciar el ciclo entrenando el Día 1.
   * A efectos de programación cuenta como descanso (implica isRest).
   */
  optionalRest?: boolean;
  /** Intensidad 1-10 de este entrenamiento (Método REIN TENA), la fija el coach. */
  intensity?: number;
  /** El coach activa el temporizador de intervalos (EMOM) para este día. */
  showIntervalTimer?: boolean;
  /**
   * Texto de las "aproximaciones" del calentamiento para este día, editable por
   * el coach (paso 3 del calentamiento). Vacío = usa el texto por defecto.
   */
  approachesNote?: string;
  exercises: RoutineExercise[];
}

/**
 * Cómo se programa una rutina:
 *  - 'weekly': cada día se asigna a un día de la semana (lun/mié/vie...).
 *  - 'cycle' (Método REIN TENA): los días rotan en un ciclo constante
 *    (Día 1 → 2 → 3 → ... → repite) independientemente del día de la semana.
 */
export type RoutineSchedule = 'weekly' | 'cycle' | 'flex';

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
  /**
   * Nombre del modo 'flex' que el coach muestra al alumno (p. ej.
   * "Sensaciones"): el alumno elige qué rutina hacer cada día según se sienta.
   */
  scheduleLabel?: string;
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
  scheduleLabel?: string;
  cycleStartDate?: number;
  days: RoutineDay[];
  createdAt: number;
}

/**
 * Test de nivel: marca máxima verificada por el coach en un hito de
 * calistenia (máx. dominadas, aguante de planche...). Historial objetivo del
 * nivel real del alumno, separado del día a día de las rutinas.
 */
export interface LevelTest {
  id: string;
  trainerId: string;
  clientId: string;
  /** Nombre del test (p. ej. "Dominadas máximas", "Planche hold"). */
  name: string;
  value: number;
  unit: 'reps' | 'seconds';
  date: number;
  createdAt: number;
}

/**
 * Ciclos de entrenamiento (planificación). Los tres niveles son OPCIONALES e
 * independientes: el coach decide si usa alguno, y cuáles, para cada alumno.
 * Un ciclo es solo un contenedor con fechas; las estadísticas se derivan de
 * los entrenos que el alumno registra dentro de ese rango. Si el coach no crea
 * ninguno, la app funciona exactamente igual que ahora.
 */
export type CycleLevel = 'macro' | 'meso' | 'micro';

export const CYCLE_LEVEL_LABEL: Record<CycleLevel, string> = {
  macro: 'Macrociclo',
  meso: 'Mesociclo',
  micro: 'Microciclo',
};

/** Semanas por defecto que dura cada nivel al crearlo (editable). */
export const CYCLE_DEFAULT_WEEKS: Record<CycleLevel, number> = {
  macro: 12,
  meso: 4,
  micro: 1,
};

export interface TrainingCycle {
  id: string;
  trainerId: string;
  clientId: string;
  level: CycleLevel;
  name: string;
  /** Fechas (medianoche). Opcionales: un ciclo puede quedar abierto. */
  startDate?: number;
  endDate?: number;
  /** Objetivo del ciclo (texto libre). */
  goal?: string;
  /** Notas privadas del coach. */
  notes?: string;
  /** Meta de sesiones para el % completado y avisos (opcional). */
  targetSessions?: number;
  /** Solo microciclo: semana de descarga (deload). */
  isDeload?: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Agenda del coach: tareas de negocio organizadas por horizonte (hoy / esta
 * semana / este mes) y objetivos de emprendimiento con progreso. Privadas del
 * entrenador; no tienen nada que ver con las rutinas de los alumnos.
 */
export type TaskScope = 'day' | 'week' | 'month' | 'goal';

export const TASK_SCOPE_LABEL: Record<TaskScope, string> = {
  day: 'Hoy',
  week: 'Semana',
  month: 'Mes',
  goal: 'Objetivos',
};

export interface CoachTask {
  id: string;
  trainerId: string;
  title: string;
  scope: TaskScope;
  done: boolean;
  doneAt?: number;
  /** Destacada (prioridad): sube arriba y se marca en oro. */
  flagged?: boolean;
  notes?: string;
  /** Solo objetivos: progreso 0-100. */
  progress?: number;
  /**
   * Solo tareas de día: fecha concreta en el calendario (00:00). Si falta, la
   * tarea se entiende "para hoy". El coach puede moverla a otro día.
   */
  dueDate?: number;
  /** Orden estable dentro de su lista (por defecto, momento de creación). */
  order: number;
  createdAt: number;
  updatedAt: number;
}

/** Pago registrado por el entrenador (para el historial de ingresos). */
export interface Payment {
  id: string;
  trainerId: string;
  clientId: string;
  amountEur: number;
  date: number;
  createdAt: number;
}

export interface LoggedSet {
  /**
   * Marca principal de la serie. En ejercicios por repeticiones (y en la parte
   * de repeticiones de un combo) son reps; en los isométricos, segundos.
   */
  reps: string;
  /** Aguante en segundos de la serie. Solo lo usan los ejercicios 'combo'. */
  seconds?: string;
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

/** Una foto dentro de una libreta de comida del entrenador. */
export interface MealBookPhoto {
  id: string;
  /** Foto (data URL comprimida). */
  imageURL: string;
  /** Pie de foto opcional (nombre del plato, ingredientes...). */
  caption?: string;
}

/**
 * "Libreta" / cuaderno de comidas que el entrenador sube UNA vez y comparten
 * TODOS sus alumnos (recetas, ejemplos de platos por foto). Se ve dentro de la
 * app, al final de la sección de nutrición del alumno.
 */
export interface MealBook {
  id: string;
  trainerId: string;
  title: string;
  photos: MealBookPhoto[];
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
  /** Racha en curso DENTRO del mes actual (se reinicia cada mes). */
  streakThisMonth?: number;
  /** Entrenos registrados en el mes actual (se reinicia cada mes). */
  workoutsThisMonth?: number;
  /** Mejor racha lograda el MES ANTERIOR (para el podio del cambio de mes). */
  lastMonthStreak?: number;
  /** Clave "YYYY-MM" del mes en que se sincronizaron las métricas mensuales. */
  monthKey?: string;
  /**
   * Marca (lunes 00:00) de la semana en que se sincronizaron las métricas
   * semanales. Si no es la semana en curso, `sessionsThisWeek` se muestra a 0.
   */
  weekKey?: string;
  /** Sesiones dentro del periodo del reto activo (para el ranking del reto). */
  challengeSessions?: number;
  /** Último récord personal (para el tablón de récords del grupo). */
  lastPR?: { exerciseName: string; label: string; date: number };
  /** Última vez con la app abierta (presencia "en línea" para el coach). */
  lastSeen?: number;
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
  /** Tipo de contenido: vídeo (por defecto) o e-book/PDF. */
  kind?: 'video' | 'pdf';
  /** URL del vídeo (Firebase Storage, Vimeo privado, etc.). Puede estar vacío. */
  videoUrl?: string;
  durationLabel?: string;
  description?: string;
  /**
   * Candado por antigüedad: días que el alumno debe llevar en el grupo para
   * desbloquear esta lección. Vacío/0 = disponible desde el primer día.
   */
  unlockAfterDays?: number;
  /** E-book/PDF de apoyo (enlace a Drive, Dropbox...); se ve dentro de la app. */
  pdfUrl?: string;
}

export interface CourseSection {
  id: string;
  title: string;
  /** Portada de la sección (data URL comprimida), opcional. */
  coverURL?: string;
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
  /** Posición del curso en la lista (el coach los reordena). */
  order?: number;
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
