import type { PlanPersonalizado } from './planPersonalizado';
import type { RoutineDay, RoutineExercise } from './types';

/**
 * VARIAS RUTINAS EN UN MISMO ENTRENO.
 *
 * En el personalizado el alumno puede marcar más de una rutina antes de
 * empezar ("Empuje fuerte" y "Tirón medio") y se hacen en el mismo entreno.
 * Cómo se juntan lo decide el ENTRENADOR en su plan, no el alumno:
 *
 *  - 'seguidas' (lo de siempre): primero una rutina entera y después la otra.
 *  - 'superseries': se fusionan. El primer bloque de una con el primero de la
 *    otra, en superserie; después los segundos, y así. Una serie de empuje,
 *    sin descanso una de tirón, y entonces sí, descanso.
 *
 * El orden lo pone el alumno al marcarlas: si marca Tirón antes que Empuje, la
 * ronda empieza por el tirón. Es el "o viceversa".
 *
 * POR BLOQUES, NO POR EJERCICIOS
 *
 * Si una rutina ya trae una superserie suya (A1 + A2), fusionar ejercicio a
 * ejercicio la partiría y A2 acabaría emparejado con un ejercicio de la otra
 * rutina. Se fusiona por bloques: lo que el entrenador encadenó sigue
 * encadenado, y se le suma lo de la otra rutina (A1 + A2 + B1).
 *
 * LA QUE TIENE MÁS
 *
 * Si una rutina tiene cuatro bloques y la otra tres, el cuarto va solo. Es el
 * mismo caso que una superserie de series desiguales (lib/superserie.ts): no
 * se inventa una pareja que el entrenador no ha puesto.
 */
export type ComoSeCombinan = 'seguidas' | 'superseries';

/**
 * LO QUE EL ENTRENADOR AJUSTA DE LA FUSIÓN.
 *
 * Cada entrenador trabaja con su estructura y sus tiempos: hay quien hace una
 * serie de empuje, sin pausa una de tirón y después 6 minutos de descanso (lo
 * normal entrenando skills), y hay quien deja 30 segundos para cambiar de
 * barra. Y en la misma rutina puede haber ejercicios que NO se fusionan: la
 * parte de hipertrofia, con descansos cortos y cada uno a lo suyo. Para esos
 * está `aislado` en cada ejercicio.
 */
export interface AjustesDeFusion {
  /** Descanso tras cada superserie fusionada. Sin valor: el más largo de los suyos. */
  descanso?: number;
  /** Segundos entre un ejercicio y el siguiente de la superserie. Sin valor o 0: seguido. */
  transicion?: number;
}

/** Lo que haya decidido el entrenador; sin decir nada, una detrás de otra. */
export function comoSeCombinan(plan?: Pick<PlanPersonalizado, 'combinar'>): ComoSeCombinan {
  return plan?.combinar === 'superseries' ? 'superseries' : 'seguidas';
}

/** Los ajustes de la fusión del plan, ya limpios (sin negativos ni ceros que no dicen nada). */
export function ajustesDeFusion(
  plan?: Pick<PlanPersonalizado, 'descansoFusion' | 'transicionFusion'>
): AjustesDeFusion {
  const d = plan?.descansoFusion;
  const tr = plan?.transicionFusion;
  return {
    ...(typeof d === 'number' && d > 0 ? { descanso: Math.round(d) } : {}),
    ...(typeof tr === 'number' && tr > 0 ? { transicion: Math.round(tr) } : {}),
  };
}

/**
 * El orden de las rutinas al fusionar: el que marcó el alumno, o el del plan
 * (de arriba abajo, como las puso el entrenador) si así lo decidió.
 */
export function ordenParaFusionar<D extends { id: string }>(
  elegidas: D[],
  todas: { id: string }[],
  orden?: PlanPersonalizado['ordenFusion']
): D[] {
  if (orden !== 'plan') return elegidas;
  const pos = (d: D) => todas.findIndex((x) => x.id === d.id);
  return [...elegidas].sort((a, b) => pos(a) - pos(b));
}

/** Los bloques de una rutina: cada ejercicio con los que lleva encadenados detrás. */
export function bloquesDe<E extends Pick<RoutineExercise, 'supersetWithPrevious'>>(ejercicios: E[]): E[][] {
  const bloques: E[][] = [];
  ejercicios.forEach((e, i) => {
    if (i > 0 && e.supersetWithPrevious && bloques.length > 0) bloques[bloques.length - 1].push(e);
    else bloques.push([e]);
  });
  return bloques;
}

/** Un bloque con algún ejercicio aislado no se empareja con nada. */
const esAislado = (b: Pick<RoutineExercise, 'aislado'>[]) => b.some((e) => e.aislado === true);

/** El bloque tal cual, empezando suelto (su primero no se encadena con lo de antes). */
const tal = (b: RoutineExercise[]) => b.map((e, i) => (i === 0 ? { ...e, supersetWithPrevious: false } : e));

/**
 * Los ejercicios del entreno combinado, ya en su orden y con sus superseries.
 *
 * En 'superseries':
 *  - El último de cada ronda lleva el descanso del entrenador para la fusión
 *    o, sin él, el MÁS LARGO de la ronda: es tras el que se descansa (ver
 *    `descansoDelBloque`), y si el empuje pedía 2 min y el tirón 1,5, la
 *    pareja entera pide los 2.
 *  - Los aislados van solos y con SU descanso. Si están al principio de su
 *    rutina, antes de las superseries; si no, después (lo normal: skills
 *    fusionadas primero y la hipertrofia al final).
 */
export function combinarRutinas(
  dias: Pick<RoutineDay, 'exercises'>[],
  modo: ComoSeCombinan,
  ajustes: AjustesDeFusion = {}
): RoutineExercise[] {
  if (modo === 'seguidas' || dias.length < 2) {
    // Cada rutina empieza suelta: su primer ejercicio no puede encadenarse con
    // el último de la rutina de antes, aunque lo diga una marca vieja.
    return dias.flatMap((d) => d.exercises.map((e, i) => (i === 0 ? { ...e, supersetWithPrevious: false } : e)));
  }
  const partes = dias.map((d) => {
    const bloques = bloquesDe(d.exercises);
    const primero = bloques.findIndex((b) => !esAislado(b));
    const antes = primero === -1 ? bloques : bloques.slice(0, primero);
    const resto = primero === -1 ? [] : bloques.slice(primero);
    return { antes, fusionables: resto.filter((b) => !esAislado(b)), despues: resto.filter(esAislado) };
  });
  const salida: RoutineExercise[] = partes.flatMap((p) => p.antes.flatMap(tal));
  const rondas = Math.max(0, ...partes.map((p) => p.fusionables.length));
  for (let r = 0; r < rondas; r++) {
    const ronda = partes.flatMap((p) => p.fusionables[r] ?? []);
    if (ronda.length === 0) continue;
    const descanso = ajustes.descanso ?? Math.max(0, ...ronda.map((e) => e.restSeconds ?? 0));
    ronda.forEach((e, i) => {
      const ultimo = i === ronda.length - 1;
      salida.push({
        ...e,
        supersetWithPrevious: i > 0,
        ...(ultimo && descanso > 0 ? { restSeconds: descanso } : {}),
        ...(i > 0 && ajustes.transicion ? { transicionSegundos: ajustes.transicion } : {}),
      });
    });
  }
  return [...salida, ...partes.flatMap((p) => p.despues.flatMap(tal))];
}

export interface RondaParaVer {
  nombres: string[];
  /** Va sola porque el entrenador la marcó como aislada (no por sobrar). */
  aislado: boolean;
}

/**
 * Cómo va a quedar, para enseñárselo al alumno ANTES de empezar: una línea por
 * ronda con sus ejercicios. Así sabe a qué se mete y en qué orden.
 */
export function rondasDeLaCombinacion(
  ejercicios: Pick<RoutineExercise, 'name' | 'supersetWithPrevious' | 'aislado'>[]
): RondaParaVer[] {
  return bloquesDe(ejercicios).map((b) => ({ nombres: b.map((e) => e.name), aislado: esAislado(b) }));
}

/** "6 min", "2:30 min", "45 s": un descanso como lo diría el entrenador. */
export function textoDeDescanso(segundos: number): string {
  if (segundos < 60) return `${segundos} s`;
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')} min`;
}

/** Lo que escribe el entrenador en minutos ("6", "2:30", "2,5") en segundos. Vacío o raro: undefined. */
export function segundosDeMinutos(texto: string): number | undefined {
  const t = texto.trim().replace(',', '.');
  if (!t) return undefined;
  const conPuntos = /^(\d{1,2}):(\d{1,2})$/.exec(t);
  const seg = conPuntos ? Number(conPuntos[1]) * 60 + Number(conPuntos[2]) : Math.round(Number(t) * 60);
  return Number.isFinite(seg) && seg > 0 && seg <= 30 * 60 ? seg : undefined;
}
