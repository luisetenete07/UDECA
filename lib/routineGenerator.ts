import {
  resolveLoad,
  type Exercise,
  type ExperienceLevel,
  type RoutineDay,
  type RoutineExercise,
  type RoutineSchedule,
} from './types';
import { nuevoId } from './ids';

/**
 * Copiloto UDECA: genera un BORRADOR de rutina a partir de la biblioteca del
 * coach y del nivel del alumno. Es determinista (sin IA externa ni claves):
 * selecciona ejercicios por patrón (empuje/tirón/core/pierna), pone los
 * isométricos primero (trabajo de skill en fresco, estándar en calistenia) y
 * ajusta series, reps/aguantes, descanso e intensidad según el nivel.
 * El coach siempre revisa y ajusta: es un punto de partida, no un dogma.
 */


interface LevelParams {
  sets: number;
  reps: string;
  holdSec: string;
  restSeconds: number;
  intensity: number;
  perDay: { empuje: number; tiron: number; core: number; pierna: number };
}

const LEVEL_PARAMS: Record<ExperienceLevel, LevelParams> = {
  Principiante: {
    sets: 3,
    reps: '6-10',
    holdSec: '15',
    restSeconds: 120,
    intensity: 6,
    perDay: { empuje: 2, tiron: 2, core: 1, pierna: 1 },
  },
  Intermedio: {
    sets: 4,
    reps: '8-12',
    holdSec: '25',
    restSeconds: 120,
    intensity: 7,
    perDay: { empuje: 2, tiron: 2, core: 1, pierna: 1 },
  },
  Avanzado: {
    sets: 4,
    reps: '10-15',
    holdSec: '35',
    restSeconds: 150,
    intensity: 8,
    perDay: { empuje: 3, tiron: 3, core: 1, pierna: 1 },
  },
  Élite: {
    sets: 5,
    reps: '12-15',
    holdSec: '45',
    restSeconds: 180,
    intensity: 8,
    perDay: { empuje: 3, tiron: 3, core: 1, pierna: 1 },
  },
};

function toRoutineExercise(e: Exercise, p: LevelParams): RoutineExercise {
  return {
    id: nuevoId(),
    exerciseId: e.id,
    name: e.name,
    sets: p.sets,
    reps: (e.measure ?? 'reps') === 'seconds' ? p.holdSec : p.reps,
    measure: e.measure ?? 'reps',
    load: resolveLoad(e),
    band: e.band ?? false,
    restSeconds: p.restSeconds,
    rir: 2,
  };
}

/** Isométricos primero (skill en fresco), después los de repeticiones. */
function sortSkillFirst(list: Exercise[]): Exercise[] {
  return [...list].sort((a, b) => {
    const aSec = (a.measure ?? 'reps') === 'seconds' ? 0 : 1;
    const bSec = (b.measure ?? 'reps') === 'seconds' ? 0 : 1;
    return aSec - bSec;
  });
}

/** Toma `n` elementos rotando el punto de partida entre días (variedad). */
function pick(list: Exercise[], n: number, offset: number): Exercise[] {
  if (list.length === 0 || n <= 0) return [];
  const out: Exercise[] = [];
  for (let i = 0; i < Math.min(n, list.length); i++) {
    out.push(list[(offset + i) % list.length]);
  }
  return out;
}

export function generateRoutineDraft(opts: {
  library: Exercise[];
  level?: ExperienceLevel;
  schedule: RoutineSchedule;
}): RoutineDay[] {
  const level = opts.level ?? 'Intermedio';
  const p = LEVEL_PARAMS[level] ?? LEVEL_PARAMS.Intermedio;

  const byGroup = (g: string) => opts.library.filter((e) => e.muscleGroup === g);
  const empuje = byGroup('Empuje');
  const tiron = byGroup('Tirón');
  const core = byGroup('Core');
  const pierna = byGroup('Tren inferior');

  const buildTrainingDay = (name: string, dayOffset: number): RoutineDay => {
    const exercises: Exercise[] = [
      ...sortSkillFirst(pick(empuje, p.perDay.empuje, dayOffset * p.perDay.empuje)),
      ...sortSkillFirst(pick(tiron, p.perDay.tiron, dayOffset * p.perDay.tiron)),
      ...pick(core, p.perDay.core, dayOffset),
      ...pick(pierna, p.perDay.pierna, dayOffset),
    ];
    return {
      id: nuevoId(),
      name,
      intensity: p.intensity,
      exercises: exercises.map((e) => toRoutineExercise(e, p)),
    };
  };

  if (opts.schedule === 'cycle') {
    // Método REIN TENA: entreno / descanso alternos y Día 7 opcional.
    return [
      buildTrainingDay('Día 1 · Empuje y tirón', 0),
      { id: nuevoId(), name: 'Descanso', isRest: true, exercises: [] },
      buildTrainingDay('Día 3 · Empuje y tirón', 1),
      { id: nuevoId(), name: 'Descanso', isRest: true, exercises: [] },
      buildTrainingDay('Día 5 · Empuje y tirón', 2),
      { id: nuevoId(), name: 'Descanso', isRest: true, exercises: [] },
      { id: nuevoId(), name: 'Descanso opcional', isRest: true, optionalRest: true, exercises: [] },
    ];
  }

  // Semanal: 3 días clásicos (lunes, miércoles, viernes).
  return [
    { ...buildTrainingDay('Full body A', 0), weekday: 0 },
    { ...buildTrainingDay('Full body B', 1), weekday: 2 },
    { ...buildTrainingDay('Full body C', 2), weekday: 4 },
  ];
}
