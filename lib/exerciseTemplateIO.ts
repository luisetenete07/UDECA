import type { MuscleId } from './muscles';
import type { Exercise, ExerciseLoad, ExerciseMeasure } from './types';

/**
 * Exportar / importar la biblioteca de ejercicios de un entrenador como una
 * "plantilla" (JSON) para compartir entre entrenadores. La importación
 * SUSTITUYE toda la biblioteca actual (aviso de confirmación en la pantalla).
 */

const MAGIC = 'udeca';
const TYPE = 'exercise-template';

export interface ExportedExercise {
  name: string;
  muscleGroup: string;
  measure?: ExerciseMeasure;
  description?: string;
  videoUrl?: string;
  muscles?: MuscleId[];
  load?: ExerciseLoad;
  band?: boolean;
}

interface TemplateEnvelope {
  app: string;
  type: string;
  version: number;
  exportedAt: number;
  count: number;
  exercises: ExportedExercise[];
}

/** Serializa la biblioteca a JSON con sus características de este momento. */
export function buildExerciseTemplate(exercises: Exercise[]): string {
  const envelope: TemplateEnvelope = {
    app: MAGIC,
    type: TYPE,
    version: 1,
    exportedAt: Date.now(),
    count: exercises.length,
    exercises: exercises.map((e) => ({
      name: e.name,
      muscleGroup: e.muscleGroup,
      measure: e.measure,
      description: e.description,
      videoUrl: e.videoUrl,
      muscles: e.muscles,
      load: e.load,
      band: e.band,
    })),
  };
  return JSON.stringify(envelope, null, 2);
}

/** Valida y normaliza un JSON de plantilla. Devuelve null si no es válido. */
export function parseExerciseTemplate(json: string): ExportedExercise[] | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  const raw = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as TemplateEnvelope).exercises)
      ? (data as TemplateEnvelope).exercises
      : null;
  if (!raw) return null;

  const seen = new Set<string>();
  const clean: ExportedExercise[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Record<string, unknown>;
    const name = typeof e.name === 'string' ? e.name.trim() : '';
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue; // sin duplicados dentro de la plantilla
    seen.add(key);
    clean.push({
      name,
      muscleGroup:
        typeof e.muscleGroup === 'string' && e.muscleGroup.trim() ? e.muscleGroup : 'Full body',
      measure: e.measure === 'seconds' ? 'seconds' : e.measure === 'reps' ? 'reps' : undefined,
      description: typeof e.description === 'string' ? e.description : undefined,
      videoUrl: typeof e.videoUrl === 'string' ? e.videoUrl : undefined,
      muscles: Array.isArray(e.muscles)
        ? (e.muscles.filter((m) => typeof m === 'string') as MuscleId[])
        : undefined,
      load:
        e.load === 'weighted' || e.load === 'assisted' || e.load === 'none'
          ? (e.load as ExerciseLoad)
          : undefined,
      band: typeof e.band === 'boolean' ? e.band : undefined,
    });
  }
  return clean.length > 0 ? clean : null;
}
