import type { ExerciseMeasure, MuscleGroup } from './types';

/**
 * Pack de ejercicios UDECA: biblioteca de calistenia precargada para que un
 * coach nuevo empiece a montar rutinas en minutos. Sin vídeos a propósito:
 * cada coach sube los suyos propios (decisión de producto).
 */
export interface StarterExercise {
  name: string;
  muscleGroup: MuscleGroup;
  measure: ExerciseMeasure;
  description: string;
}

export const STARTER_LIBRARY: StarterExercise[] = [
  // ----- Empuje -----
  { name: 'Flexiones', muscleGroup: 'Empuje', measure: 'reps', description: 'Cuerpo en línea, codos a 45°, rango completo hasta rozar el suelo.' },
  { name: 'Flexiones arqueras', muscleGroup: 'Empuje', measure: 'reps', description: 'Un brazo trabaja y el otro asiste extendido. Alterna lados.' },
  { name: 'Flexiones pseudo-planche', muscleGroup: 'Empuje', measure: 'reps', description: 'Manos a la altura de la cadera, hombros por delante de las muñecas.' },
  { name: 'Pike push-ups', muscleGroup: 'Empuje', measure: 'reps', description: 'Cadera arriba en V, cabeza hacia el suelo. Progresión de hombro.' },
  { name: 'Fondos en paralelas', muscleGroup: 'Empuje', measure: 'reps', description: 'Baja hasta 90° de codo, hombros lejos de las orejas.' },
  { name: 'Planche lean', muscleGroup: 'Empuje', measure: 'seconds', description: 'Inclínate adelante en plancha con brazos rectos. Aguanta.' },
  { name: 'Tuck planche', muscleGroup: 'Empuje', measure: 'seconds', description: 'Rodillas al pecho, cadera a la altura de hombros, brazos rectos.' },
  { name: 'Handstand (pino)', muscleGroup: 'Empuje', measure: 'seconds', description: 'Contra pared o libre. Cuerpo alineado, empuja el suelo.' },

  // ----- Tirón -----
  { name: 'Dominadas', muscleGroup: 'Tirón', measure: 'reps', description: 'Agarre prono, pecho a la barra, control en la bajada.' },
  { name: 'Dominadas supinas', muscleGroup: 'Tirón', measure: 'reps', description: 'Agarre supino (palmas hacia ti). Más énfasis en bíceps.' },
  { name: 'Dominadas arqueras', muscleGroup: 'Tirón', measure: 'reps', description: 'Tira hacia un lado con el brazo contrario extendido. Alterna.' },
  { name: 'Remo invertido', muscleGroup: 'Tirón', measure: 'reps', description: 'Barra baja o anillas, cuerpo en línea, pecho a la barra.' },
  { name: 'Tuck front lever', muscleGroup: 'Tirón', measure: 'seconds', description: 'Rodillas al pecho colgado de la barra, espalda paralela al suelo.' },
  { name: 'Front lever', muscleGroup: 'Tirón', measure: 'seconds', description: 'Cuerpo recto y horizontal bajo la barra, brazos rectos.' },
  { name: 'Colgado activo', muscleGroup: 'Tirón', measure: 'seconds', description: 'Cuelga con escápulas deprimidas y activas. Base de todo tirón.' },

  // ----- Core -----
  { name: 'L-sit', muscleGroup: 'Core', measure: 'seconds', description: 'Piernas rectas a 90° en paralelas o suelo, hombros deprimidos.' },
  { name: 'Hollow body', muscleGroup: 'Core', measure: 'seconds', description: 'Lumbar pegada al suelo, brazos y piernas estirados sin tocar.' },
  { name: 'Elevaciones de piernas', muscleGroup: 'Core', measure: 'reps', description: 'Colgado de barra, sube piernas rectas hasta la horizontal o más.' },
  { name: 'Plancha abdominal', muscleGroup: 'Core', measure: 'seconds', description: 'Antebrazos al suelo, cuerpo en línea, glúteo y abdomen firmes.' },

  // ----- Tren inferior -----
  { name: 'Sentadillas', muscleGroup: 'Tren inferior', measure: 'reps', description: 'Profundas, talones en el suelo, rodillas siguiendo los pies.' },
  { name: 'Zancadas', muscleGroup: 'Tren inferior', measure: 'reps', description: 'Paso largo, rodilla trasera roza el suelo. Alterna piernas.' },
  { name: 'Sentadilla búlgara', muscleGroup: 'Tren inferior', measure: 'reps', description: 'Pie trasero elevado. Trabajo unilateral de pierna.' },
  { name: 'Pistol squat', muscleGroup: 'Tren inferior', measure: 'reps', description: 'Sentadilla a una pierna. Usa asistencia si hace falta.' },
  { name: 'Puente de glúteo', muscleGroup: 'Tren inferior', measure: 'reps', description: 'Tumbado, sube la cadera apretando glúteo. Pausa arriba.' },
];
