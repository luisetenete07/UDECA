import type { PlanPersonalizado } from './planPersonalizado';
import type { LoggedExercise, RoutineDay, RoutineExercise } from './types';

/**
 * VARIAS RUTINAS EN UN MISMO ENTRENO.
 *
 * En el personalizado el alumno puede marcar más de una rutina antes de
 * empezar ("Empuje fuerte" y "Tirón medio") y se hacen en el mismo entreno.
 * Cómo se juntan lo decide el ENTRENADOR en su plan, no el alumno:
 *
 *  - 'seguidas' (lo de siempre): primero una rutina entera y después la otra.
 *  - 'superseries': se fusionan SERIE A SERIE. Una serie de la primera
 *    rutina, sin descanso una de la segunda, y entonces sí, descanso; y así
 *    hasta acabarlas.
 *
 * El orden lo pone el alumno al marcarlas: si marca Tirón antes que Empuje, la
 * ronda empieza por el tirón. Es el "o viceversa".
 *
 * SERIE A SERIE, NO EJERCICIO A EJERCICIO
 *
 * Cada rutina es una fila de series, en su orden: planche = tuck ×6; front =
 * press ×2, hold ×2, dominadas ×2. Fusionar es ir sacando una de cada fila:
 *
 *   tuck – press · tuck – press · tuck – hold · tuck – hold · tuck – dominadas · tuck – dominadas
 *
 * Emparejar por ejercicios daba otra cosa —seis de tuck contra dos de press, y
 * el hold y las dominadas al final, solos— que no es lo que programa nadie.
 *
 * Para la pantalla del entreno eso son superseries normales: el tuck se parte
 * en tramos (2 + 2 + 2), cada uno en superserie con lo que le toca de la otra
 * rutina. Lo que una rutina ya traía encadenado (A1 + A2) sigue encadenado y
 * cuenta como UNA vuelta de su fila.
 *
 * LA QUE TIENE MÁS
 *
 * Si una fila se acaba antes, lo que queda de la otra va solo, con su descanso
 * de fusión. No se inventa una pareja que el entrenador no ha puesto.
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
  // Cada rutina, como fila de vueltas: una serie de un ejercicio suelto, o una
  // vuelta de una superserie suya.
  const filas = partes.map((p) => vueltasDe(p.fusionables));
  const largo = Math.max(0, ...filas.map((f) => f.length));
  // Ronda a ronda, una vuelta de cada fila; las rondas seguidas con los mismos
  // ejercicios se juntan en un tramo (tuck + press ×2).
  const tramos: { vueltas: (RoutineExercise[] | null)[]; rondas: number }[] = [];
  const clave = (vs: (RoutineExercise[] | null)[]) => vs.map((v) => (v ? v.map((e) => e.id).join('+') : '-')).join('|');
  for (let r = 0; r < largo; r++) {
    const vueltas = filas.map((f) => f[r] ?? null);
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && clave(ultimo.vueltas) === clave(vueltas)) ultimo.rondas++;
    else tramos.push({ vueltas, rondas: 1 });
  }
  // Un mismo ejercicio partido en tramos lleva un id por tramo: la pantalla los
  // trata como ejercicios distintos y el id se usa de clave.
  const vecesVisto = new Map<string, number>();
  for (const t of tramos) {
    const miembros = t.vueltas.flatMap((v) => v ?? []);
    const descanso = ajustes.descanso ?? Math.max(0, ...miembros.map((e) => e.restSeconds ?? 0));
    miembros.forEach((e, i) => {
      const n = vecesVisto.get(e.id) ?? 0;
      vecesVisto.set(e.id, n + 1);
      const ultimo = i === miembros.length - 1;
      salida.push({
        ...e,
        id: n === 0 ? e.id : `${e.id}~${n + 1}`,
        sets: t.rondas,
        supersetWithPrevious: i > 0,
        ...(ultimo && descanso > 0 ? { restSeconds: descanso } : {}),
        ...(i > 0 && ajustes.transicion ? { transicionSegundos: ajustes.transicion } : {}),
      });
    });
  }
  return [...salida, ...partes.flatMap((p) => p.despues.flatMap(tal))];
}

/**
 * Una rutina como fila de vueltas, en su orden: tuck ×6 son seis vueltas de
 * tuck; una superserie suya A1 + A2 de 3 series, tres vueltas de [A1, A2] (si
 * uno lleva menos series, sus últimas vueltas van sin él).
 */
function vueltasDe(bloques: RoutineExercise[][]): RoutineExercise[][] {
  const vueltas: RoutineExercise[][] = [];
  for (const b of bloques) {
    const rondas = Math.max(0, ...b.map((e) => Math.max(0, Math.floor(e.sets || 0))));
    for (let r = 0; r < rondas; r++) {
      const vuelta = b.filter((e) => r < Math.floor(e.sets || 0));
      if (vuelta.length > 0) vueltas.push(vuelta);
    }
  }
  return vueltas;
}

export interface RondaParaVer {
  nombres: string[];
  /** Cuántas veces se repite (las series de cada uno en ese tramo). */
  series: number;
  /** Va sola porque el entrenador la marcó como aislada (no por sobrar). */
  aislado: boolean;
}

/**
 * Cómo va a quedar, para enseñárselo al alumno ANTES de empezar: una línea por
 * ronda con sus ejercicios. Así sabe a qué se mete y en qué orden.
 */
export function rondasDeLaCombinacion(
  ejercicios: Pick<RoutineExercise, 'name' | 'supersetWithPrevious' | 'aislado' | 'sets'>[]
): RondaParaVer[] {
  return bloquesDe(ejercicios).map((b) => ({
    nombres: b.map((e) => e.name),
    series: Math.max(0, ...b.map((e) => e.sets ?? 0)),
    aislado: esAislado(b),
  }));
}

/**
 * Las primeras `n` rondas, una a una ("Tuck – Press"), para el ejemplo que ve
 * el entrenador: así se lee la fusión tal cual se va a entrenar.
 */
export function primerasRondas(
  ejercicios: Pick<RoutineExercise, 'name' | 'supersetWithPrevious' | 'aislado' | 'sets'>[],
  n: number
): string[][] {
  const salida: string[][] = [];
  for (const r of rondasDeLaCombinacion(ejercicios)) {
    if (r.aislado) continue;
    for (let i = 0; i < Math.max(1, r.series) && salida.length < n; i++) salida.push(r.nombres);
    if (salida.length >= n) break;
  }
  return salida;
}

/**
 * AL GUARDAR, CADA EJERCICIO EN UNA SOLA FILA.
 *
 * Fusionando serie a serie, el tuck se entrena en tramos (2 + 2 + 2) y la
 * pantalla los lleva como ejercicios distintos. En el historial, en cambio, lo
 * que se quiere ver es "Tuck planche, 6 series": tres filas de tuck harían
 * creer que se entrenó tres veces, y partirían sus marcas.
 *
 * Se juntan solo los tramos de la fusión (id con `~`), en el orden en que se
 * hicieron. Un ejercicio que el entrenador puso dos veces a propósito sigue
 * siendo dos.
 */
export function juntarTramos(log: LoggedExercise[], plan: Pick<RoutineExercise, 'id'>[]): LoggedExercise[] {
  const base = (i: number) => (plan[i]?.id ?? '').split('~')[0];
  const salida: LoggedExercise[] = [];
  const dondeVa = new Map<string, number>();
  log.forEach((ex, i) => {
    const id = plan[i]?.id ?? '';
    const k = base(i);
    const destino = id.includes('~') ? dondeVa.get(k) : undefined;
    if (destino === undefined) {
      if (k) dondeVa.set(k, salida.length);
      salida.push(ex);
      return;
    }
    const antes = salida[destino];
    salida[destino] = {
      ...antes,
      sets: [...antes.sets, ...ex.sets],
      // Saltado solo si se saltaron todos sus tramos.
      saltado: antes.saltado && ex.saltado ? true : undefined,
      notes: [antes.notes, ex.notes].filter((n) => n?.trim()).join(' · ') || undefined,
      rir: ex.rir ?? antes.rir,
      esfuerzo: ex.esfuerzo ?? antes.esfuerzo,
    };
  });
  return salida;
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
