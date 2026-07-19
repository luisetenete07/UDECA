import type { MuscleGroup, WorkoutLog } from './types';

/**
 * Estándar muscular de la app. Cada ejercicio "activa" uno o varios músculos
 * con un peso (1 = principal, 0.5 = secundario). Se clasifica por el NOMBRE del
 * ejercicio (robusto para calistenia) y, si no hay coincidencia, por su grupo
 * muscular. El resultado alimenta el mapa corporal de la sección Progreso.
 */
export type MuscleId =
  | 'chest'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'traps'
  | 'lats'
  | 'lowerBack'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves';

export const MUSCLE_LABEL: Record<MuscleId, string> = {
  chest: 'Pecho',
  shoulders: 'Hombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebrazos',
  abs: 'Abdomen',
  traps: 'Trapecio',
  lats: 'Dorsales',
  lowerBack: 'Lumbar',
  glutes: 'Glúteos',
  quads: 'Cuádriceps',
  hamstrings: 'Isquios',
  calves: 'Gemelos',
};

type Weights = Partial<Record<MuscleId, number>>;

/** Reglas por palabra clave (calistenia). El orden no importa; se acumulan. */
const KEYWORD_RULES: { match: RegExp; muscles: Weights }[] = [
  // Tirón vertical
  { match: /dominad|pull[\s-]?up|jalon|jalón/, muscles: { lats: 1, biceps: 0.5, traps: 0.5, forearms: 0.5 } },
  { match: /chin[\s-]?up|supina/, muscles: { biceps: 1, lats: 0.8, forearms: 0.5 } },
  { match: /muscle[\s-]?up/, muscles: { lats: 1, chest: 0.6, triceps: 0.6, biceps: 0.6 } },
  // Tirón horizontal
  { match: /remo|row|australian|invertid/, muscles: { traps: 1, lats: 0.7, biceps: 0.5 } },
  { match: /front lever/, muscles: { lats: 1, abs: 0.8, traps: 0.6, lowerBack: 0.4 } },
  { match: /back lever/, muscles: { chest: 0.7, shoulders: 0.6, lats: 0.6, abs: 0.5 } },
  // Empuje horizontal
  { match: /fondo|dip/, muscles: { chest: 1, triceps: 0.8, shoulders: 0.6 } },
  { match: /flexion|flexión|push[\s-]?up|press de banca|press banca/, muscles: { chest: 1, triceps: 0.6, shoulders: 0.5 } },
  { match: /planche|plancha(?!\s*abdominal)/, muscles: { shoulders: 1, chest: 0.7, triceps: 0.5, abs: 0.5 } },
  // Empuje vertical
  { match: /pike|handstand|pino|hspu|vertical|militar|overhead|press hombro/, muscles: { shoulders: 1, triceps: 0.6, traps: 0.4 } },
  // Brazos aislados
  { match: /curl|b[ií]ceps/, muscles: { biceps: 1, forearms: 0.4 } },
  { match: /extension de tr[ií]ceps|tr[ií]ceps|press franc[eé]s|jalon tr/, muscles: { triceps: 1 } },
  { match: /antebrazo|grip|agarre|mu[ñn]eca/, muscles: { forearms: 1 } },
  // Core
  { match: /l[\s-]?sit|leg raise|elevaci[oó]n de piernas|elevacion de piernas|toes to bar|hollow|crunch|abdominal|dragon flag|plancha abdominal|plank/, muscles: { abs: 1 } },
  { match: /oblicuo|russian|twist/, muscles: { abs: 0.8 } },
  { match: /hiperextens|superman|lumbar|back extension|extensi[oó]n de espalda/, muscles: { lowerBack: 1, glutes: 0.5 } },
  // Pierna
  { match: /sentadilla|squat|pistol|bulgara|bulgarian|wall sit/, muscles: { quads: 1, glutes: 0.7 } },
  { match: /zancada|lunge|split/, muscles: { quads: 0.9, glutes: 0.7 } },
  { match: /peso muerto|deadlift|hip thrust|puente|bridge|gl[uú]teo|hinge|nordic/, muscles: { glutes: 1, hamstrings: 0.9, lowerBack: 0.5 } },
  { match: /femoral|isquio|curl femoral/, muscles: { hamstrings: 1 } },
  { match: /gemelo|calf|talon|talón|pantorrilla/, muscles: { calves: 1 } },
  { match: /shrug|encogimiento|trapecio/, muscles: { traps: 1 } },
];

/** Reparto por grupo muscular cuando el nombre no dice nada concreto. */
const GROUP_FALLBACK: Record<MuscleGroup, Weights> = {
  'Tren superior': { chest: 0.6, shoulders: 0.6, lats: 0.6, biceps: 0.4, triceps: 0.4 },
  'Tren inferior': { quads: 0.8, glutes: 0.8, hamstrings: 0.6, calves: 0.5 },
  Core: { abs: 1, lowerBack: 0.5 },
  Empuje: { chest: 0.9, shoulders: 0.7, triceps: 0.7 },
  Tirón: { lats: 0.9, traps: 0.6, biceps: 0.7 },
  'Full body': { chest: 0.4, lats: 0.4, quads: 0.4, glutes: 0.4, abs: 0.4, shoulders: 0.4 },
  Movilidad: {},
  Cardio: {},
};

/** Músculos que trabaja un ejercicio, por nombre (y grupo opcional de apoyo). */
export function musclesForExercise(name: string, group?: string): Weights {
  const n = (name || '').toLowerCase();
  const acc: Weights = {};
  let matched = false;
  for (const rule of KEYWORD_RULES) {
    if (rule.match.test(n)) {
      matched = true;
      for (const [m, w] of Object.entries(rule.muscles)) {
        acc[m as MuscleId] = Math.max(acc[m as MuscleId] ?? 0, w as number);
      }
    }
  }
  const fallback = group ? GROUP_FALLBACK[group as MuscleGroup] : undefined;
  if (!matched && fallback) {
    return { ...fallback };
  }
  return acc;
}

/**
 * Carga por músculo a partir de los entrenos (series completadas × peso del
 * músculo). Devuelve valores NORMALIZADOS 0..1 (1 = el más trabajado del
 * periodo), listos para colorear el cuerpo. `groupByExerciseId` es opcional y
 * refina la clasificación cuando el nombre no basta.
 */
export function muscleLoad(
  logs: WorkoutLog[],
  sinceTs?: number,
  groupByExerciseId?: Record<string, string>,
  musclesByExerciseId?: Record<string, MuscleId[]>
): Record<MuscleId, number> {
  const raw = {} as Record<MuscleId, number>;
  (Object.keys(MUSCLE_LABEL) as MuscleId[]).forEach((m) => (raw[m] = 0));

  for (const log of logs) {
    if (sinceTs && log.date < sinceTs) continue;
    for (const ex of log.exercises) {
      const completed = ex.sets.filter((s) => s.completed).length;
      if (completed === 0) continue;
      // Si el ejercicio define músculos explícitos (plantilla UDECA), mandan
      // ellos; si no, se clasifica por nombre y grupo.
      const explicit = musclesByExerciseId?.[ex.exerciseId];
      const map =
        explicit && explicit.length > 0
          ? (Object.fromEntries(explicit.map((m) => [m, 1])) as Weights)
          : musclesForExercise(ex.name, groupByExerciseId?.[ex.exerciseId]);
      for (const [m, w] of Object.entries(map)) {
        raw[m as MuscleId] += completed * (w as number);
      }
    }
  }

  const max = Math.max(1, ...Object.values(raw));
  const norm = {} as Record<MuscleId, number>;
  (Object.keys(raw) as MuscleId[]).forEach((m) => (norm[m] = raw[m] / max));
  return norm;
}
