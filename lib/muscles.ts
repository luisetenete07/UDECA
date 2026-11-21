import type { MuscleGroup, WorkoutLog } from './types';

/**
 * Estándar muscular de la app. Cada ejercicio "activa" uno o varios músculos
 * con un peso (1 = principal, 0.5 = secundario). Se deduce SOLO del nombre
 * del ejercicio, con lo que se sabe de calistenia (CONOCIMIENTO, abajo), y si
 * el nombre no dice nada, de su categoría. El resultado alimenta el mapa
 * corporal de Progreso y el "Trabaja…" de la biblioteca del entrenador.
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

export type Weights = Partial<Record<MuscleId, number>>;

/**
 * QUÉ TRABAJA CADA EJERCICIO, DEDUCIDO SOLO.
 *
 * Luis no tiene que decirle a la app qué músculos trabaja cada ejercicio: se
 * deduce del nombre con lo que se sabe de calistenia (biomecánica de cada
 * patrón: qué músculo mueve, cuál estabiliza). 1 = el que manda, 0,5 = el que
 * ayuda de verdad, menos = el que acompaña.
 *
 * Va DE LO MÁS CONCRETO A LO MÁS GENERAL y gana la primera que encaja: una
 * "flexión en pino" es un empuje vertical, no una flexión; un "curl nórdico"
 * es isquio, no bíceps; una "plancha" a secas es abdomen, y una "plancha
 * straddle" es la planche. Antes las reglas se sumaban todas y "Plancha"
 * contaba como hombro.
 *
 * El nombre se lee sin tildes ni mayúsculas, en español o en inglés.
 */
interface Conocimiento {
  /** Patrón sobre el nombre ya normalizado (sin tildes, en minúsculas). */
  match: RegExp;
  muscles: Weights;
}

const CONOCIMIENTO: Conocimiento[] = [
  // ---- Habilidades y estáticos (lo más concreto primero) ----
  { match: /muscle[\s-]?up|subida a la barra|subidas a la barra/, muscles: { lats: 1, triceps: 0.8, chest: 0.6, biceps: 0.6, shoulders: 0.5, traps: 0.4, abs: 0.3 } },
  { match: /front lever|lever frontal|palanca frontal/, muscles: { lats: 1, abs: 0.9, traps: 0.6, lowerBack: 0.4, biceps: 0.3, forearms: 0.3 } },
  { match: /back lever|lever trasero|palanca trasera|palanca dorsal/, muscles: { chest: 0.7, shoulders: 0.7, biceps: 0.6, lats: 0.6, abs: 0.5, lowerBack: 0.4 } },
  { match: /human flag|bandera humana|\bbandera\b|\bflag\b/, muscles: { lats: 1, shoulders: 0.9, abs: 0.9, triceps: 0.4, forearms: 0.4 } },
  { match: /pseudo[\s-]?planche|pseudo[\s-]?plancha|planche (push|lean)|plancha (inclinada|lean)/, muscles: { shoulders: 1, chest: 0.8, triceps: 0.7, abs: 0.4, forearms: 0.3 } },
  { match: /planche|plancha (tuck|recogida|agrupada|straddle|abierta|completa|full|advanced|avanzada)|tuck planche/, muscles: { shoulders: 1, chest: 0.7, triceps: 0.6, abs: 0.6, forearms: 0.4, biceps: 0.3 } },
  { match: /handstand push|hspu|flexion(es)? (en|de) pino|press (en|de) pino|pino flexion/, muscles: { shoulders: 1, triceps: 0.8, traps: 0.5, chest: 0.2 } },
  { match: /handstand|\bpino\b|\bpinos\b|parada de manos/, muscles: { shoulders: 1, traps: 0.6, triceps: 0.4, abs: 0.4, forearms: 0.4 } },
  { match: /\bl[\s-]?sit|\bv[\s-]?sit|manna|escuadra/, muscles: { abs: 1, quads: 0.4, triceps: 0.5, shoulders: 0.4 } },
  { match: /dragon flag|bandera del dragon/, muscles: { abs: 1, lats: 0.3, lowerBack: 0.3 } },
  { match: /skin the cat|german hang|colgado aleman/, muscles: { shoulders: 0.9, lats: 0.6, chest: 0.5, biceps: 0.4, abs: 0.4 } },
  { match: /soporte|support hold|ring support|top hold/, muscles: { triceps: 0.8, shoulders: 0.7, chest: 0.5, abs: 0.3 } },

  // ---- Tirón ----
  { match: /(a|de) una mano.*(dominad|pull)|one[\s-]?arm (pull|chin)/, muscles: { lats: 1, biceps: 0.8, forearms: 0.7, traps: 0.5, abs: 0.4 } },
  { match: /chin[\s-]?up|dominadas? supinas?|supin/, muscles: { biceps: 1, lats: 0.9, forearms: 0.5, traps: 0.3 } },
  { match: /dominad|pull[\s-]?up|jalon|lat pulldown|typewriter|arquer(a|o) en barra/, muscles: { lats: 1, biceps: 0.6, traps: 0.5, forearms: 0.5, shoulders: 0.2 } },
  { match: /escapular|scap(ular)? pull|retraccion|depresion escapular/, muscles: { traps: 1, lats: 0.5 } },
  { match: /face pull|pajaro|reverse fly|aperturas? invertidas?/, muscles: { shoulders: 0.9, traps: 0.8 } },
  { match: /\bremo|row|australian|invertid|inverted|tuck row/, muscles: { traps: 0.9, lats: 0.8, biceps: 0.6, shoulders: 0.3, forearms: 0.3 } },

  // ---- Empuje ----
  { match: /fondos? (en|de) banco|bench dip/, muscles: { triceps: 1, shoulders: 0.4, chest: 0.3 } },
  { match: /fondo|\bdips?\b|korean/, muscles: { chest: 1, triceps: 0.9, shoulders: 0.6 } },
  { match: /pike|en pica|\bpica\b/, muscles: { shoulders: 1, triceps: 0.7, chest: 0.3, traps: 0.3 } },
  { match: /diamante|diamond|flexion(es)? (cerradas|estrechas)|close[\s-]?grip push/, muscles: { triceps: 1, chest: 0.7, shoulders: 0.4 } },
  { match: /declinad|decline push|pies elevados/, muscles: { chest: 0.9, shoulders: 0.8, triceps: 0.6 } },
  { match: /flexion|push[\s-]?up|lagartija|press de banca|press banca|bench press/, muscles: { chest: 1, triceps: 0.7, shoulders: 0.5, abs: 0.3 } },
  { match: /press militar|overhead|press (de )?hombro|shoulder press/, muscles: { shoulders: 1, triceps: 0.6, traps: 0.4 } },

  // ---- Brazos y hombro aislados ----
  { match: /curl n[o]rdico|nordic|curl femoral|femoral|isquio|leg curl/, muscles: { hamstrings: 1, glutes: 0.3 } },
  { match: /curl|biceps|bicep/, muscles: { biceps: 1, forearms: 0.4 } },
  { match: /extensi(on|ones) de triceps|triceps|skull|press frances/, muscles: { triceps: 1 } },
  { match: /elevaci(on|ones) laterales?|lateral raise|elevaci(on|ones) frontales?/, muscles: { shoulders: 1, traps: 0.3 } },
  { match: /antebrazo|forearm|muneca|wrist|grip|agarre/, muscles: { forearms: 1 } },
  { match: /shrug|encogimiento|trapecio/, muscles: { traps: 1 } },

  // ---- Core ----
  { match: /plancha lateral|side plank/, muscles: { abs: 1, glutes: 0.3, shoulders: 0.3 } },
  { match: /plancha|plank/, muscles: { abs: 1, shoulders: 0.3, glutes: 0.2 } },
  { match: /toes to bar|knees to (bar|elbow)|elevaci(on|ones) de (piernas|rodillas)|leg raise|knee raise/, muscles: { abs: 1, forearms: 0.4, lats: 0.3 } },
  // Colgarse a secas (después de las elevaciones colgado, que son abdomen).
  { match: /colgad|dead hang|suspension|\bhang\b|cuelgue/, muscles: { forearms: 1, lats: 0.4, traps: 0.3 } },
  { match: /hollow|arco hueco|banana/, muscles: { abs: 1 } },
  { match: /rueda abdominal|ab wheel|rollout|roll out/, muscles: { abs: 1, lats: 0.4, shoulders: 0.3 } },
  { match: /oblicuo|russian|twist|limpiaparabrisas|windshield|wiper/, muscles: { abs: 1 } },
  { match: /crunch|abdominal|sit[\s-]?up|encogimiento abdominal/, muscles: { abs: 1 } },
  { match: /superman|hiperextens|back extension|extensi(on|ones) (de espalda|lumbar)|lumbar/, muscles: { lowerBack: 1, glutes: 0.5, hamstrings: 0.3 } },

  // ---- Pierna ----
  { match: /pistol|sentadilla (a una pierna|unilateral)|shrimp|gamba|bulgar|bulgarian/, muscles: { quads: 1, glutes: 0.8, hamstrings: 0.3, abs: 0.2 } },
  { match: /sissy/, muscles: { quads: 1 } },
  { match: /zancada|lunge|split squat|step[\s-]?up|subida al cajon/, muscles: { quads: 0.9, glutes: 0.8, hamstrings: 0.4 } },
  { match: /sentadilla|squat|wall sit|silla en pared/, muscles: { quads: 1, glutes: 0.7, hamstrings: 0.3 } },
  { match: /hip thrust|puente de gluteo|glute bridge|gluteo/, muscles: { glutes: 1, hamstrings: 0.5 } },
  { match: /peso muerto|deadlift|good morning|buenos dias|rumano|hinge/, muscles: { hamstrings: 1, glutes: 0.9, lowerBack: 0.6 } },
  { match: /\bpuente\b|\bbridge\b|wheel pose/, muscles: { lowerBack: 0.8, shoulders: 0.6, glutes: 0.5 } },
  { match: /gemelo|calf|talon|pantorrilla|soleo/, muscles: { calves: 1 } },
  { match: /salto|jump|pliometr|plyo|box/, muscles: { quads: 0.8, glutes: 0.7, calves: 0.6 } },

  // ---- Cuerpo entero ----
  { match: /burpee/, muscles: { quads: 0.6, chest: 0.5, shoulders: 0.4, abs: 0.4, glutes: 0.4 } },
  { match: /comba|jump rope|cuerda/, muscles: { calves: 1, shoulders: 0.2 } },
];

/** Sin tildes, en minúsculas y con un solo espacio: así se compara un nombre. */
function normalizar(nombre: string): string {
  return (nombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Lo que se sabe de un ejercicio por su nombre, o null si el nombre no dice
 * nada (entonces manda su categoría). Movilidad y estiramientos no cargan
 * ningún músculo: devuelven un reparto vacío, que también es saber algo.
 */
export function conocimientoDelEjercicio(nombre: string): Weights | null {
  const n = normalizar(nombre);
  if (!n) return null;
  if (/movilidad|estiramiento|stretch|mobility|calentamiento|respiraci/.test(n)) return {};
  for (const c of CONOCIMIENTO) {
    if (c.match.test(n)) {
      const w: Weights = { ...c.muscles };
      // Un L-sit metido en otro ejercicio ("dominadas en L") suma abdomen.
      if (!/\bl[\s-]?sit/.test(c.match.source) && /\bl[\s-]?sit|en l\b/.test(n)) {
        w.abs = Math.max(w.abs ?? 0, 0.6);
      }
      return w;
    }
  }
  return null;
}

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

/**
 * Pesos 0..1 de un ejercicio de biblioteca a partir de sus campos del pack:
 * usa los porcentajes del admin si existen; si solo hay lista de músculos
 * (datos antiguos), cada uno cuenta al 100 %.
 */
export function weightsOfExercise(ex: {
  muscles?: MuscleId[];
  muscleWeights?: Partial<Record<MuscleId, number>>;
}): Weights | null {
  if (ex.muscleWeights && Object.keys(ex.muscleWeights).length > 0) {
    const w: Weights = {};
    for (const [m, pct] of Object.entries(ex.muscleWeights)) {
      if ((pct ?? 0) > 0) w[m as MuscleId] = Math.min(1, (pct as number) / 100);
    }
    return Object.keys(w).length > 0 ? w : null;
  }
  if (ex.muscles && ex.muscles.length > 0) {
    return Object.fromEntries(ex.muscles.map((m) => [m, 1])) as Weights;
  }
  return null;
}

/**
 * Los músculos principales de un ejercicio, por su nombre en pantalla: los que
 * trabajan a la mitad o más, de más a menos y hasta tres. Es lo que dice la
 * biblioteca del coach debajo de cada ejercicio; un cuarto ya es ruido.
 */
export function musculosPrincipales(ex: {
  name: string;
  muscleGroup?: string;
  muscles?: MuscleId[];
  muscleWeights?: Partial<Record<MuscleId, number>>;
}): string[] {
  // Se deduce del nombre: lo que se apuntó a mano en la plantilla antigua
  // solo cuenta si el nombre no dice nada.
  const pesos = conocimientoDelEjercicio(ex.name) ?? weightsOfExercise(ex) ?? musclesForExercise('', ex.muscleGroup);
  return (Object.entries(pesos) as [MuscleId, number][])
    .filter(([, w]) => w >= 0.5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m]) => MUSCLE_LABEL[m]);
}

/**
 * Músculos que trabaja un ejercicio: lo que se sabe por su nombre y, si el
 * nombre no dice nada, su categoría. Sin ninguna de las dos, nada.
 */
export function musclesForExercise(name: string, group?: string): Weights {
  const sabido = conocimientoDelEjercicio(name);
  if (sabido) return sabido;
  const fallback = group ? GROUP_FALLBACK[group as MuscleGroup] : undefined;
  return fallback ? { ...fallback } : {};
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
  // Pesos explícitos 0..1 por músculo (del pack: 25/50/75/100 % → 0,25..1).
  weightsByExerciseId?: Record<string, Weights>
): Record<MuscleId, number> {
  const raw = {} as Record<MuscleId, number>;
  (Object.keys(MUSCLE_LABEL) as MuscleId[]).forEach((m) => (raw[m] = 0));

  for (const log of logs) {
    if (sinceTs && log.date < sinceTs) continue;
    for (const ex of log.exercises) {
      const completed = ex.sets.filter((s) => s.completed).length;
      if (completed === 0) continue;
      // Lo que se sabe del ejercicio por su nombre manda (no hay que
      // apuntarlo a mano). Lo apuntado en la plantilla antigua, solo si el
      // nombre no dice nada; y si tampoco, su categoría.
      const explicit = weightsByExerciseId?.[ex.exerciseId];
      const map =
        conocimientoDelEjercicio(ex.name) ??
        (explicit && Object.keys(explicit).length > 0
          ? explicit
          : musclesForExercise('', groupByExerciseId?.[ex.exerciseId]));
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
