import { startOfWeek, toNum } from './stats';
import { planCalendar } from './cyclePlan';
import type { Routine, TrainingCycle, WorkoutLog } from './types';

/**
 * La vista general de un bloque: volumen, frecuencia y equilibrio de un
 * mesociclo entero en una sola tabla, más los avisos que salen de ella.
 *
 * Existe porque la app enseñaba muchos datos y no sumaba ninguno: las series
 * por grupo estaban en la pantalla del alumno, las marcas en la del coach, la
 * frecuencia no la calculaba nadie y nada estaba atado al bloque. Un entrenador
 * que quiere saber si un plan está equilibrado no puede tener que hacer la suma
 * de cabeza; para eso ya tenía el Excel.
 *
 * Todo es cálculo puro: entra lo que ya hay en la base (rutina, entrenos,
 * biblioteca) y sale la tabla. Sin estado, sin Firestore, sin React.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface BlockWeek {
  start: number;
  end: number;
  /** 1..n dentro del bloque. */
  index: number;
  label: string;
  isDeload: boolean;
  /** Entrenos previstos esa semana (null si la rutina no permite saberlo). */
  sessionsPlanned: number | null;
  sessionsDone: number;
  isCurrent: boolean;
  isPast: boolean;
  /** Todavía no ha empezado: no se le puede exigir nada. */
  isFuture: boolean;
}

export interface BlockRow {
  group: string;
  /** Series previstas por semana; null donde no se puede calcular. */
  planned: (number | null)[];
  done: number[];
  totalPlanned: number;
  totalDone: number;
}

export interface BlockAlert {
  id: string;
  tone: 'bad' | 'warn' | 'good';
  title: string;
  detail: string;
}

export interface BlockView {
  weeks: BlockWeek[];
  rows: BlockRow[];
  alerts: BlockAlert[];
  /** Hecho / previsto en series, 0..1. Null si no hay previsión. */
  adherence: number | null;
  totalDone: number;
  totalPlanned: number;
  /** false = la rutina no deja saber lo previsto (modo sensaciones). */
  hasPlan: boolean;
}

// ---------------------------------------------------------------------------
// Lo previsto, sacado de la rutina activa
// ---------------------------------------------------------------------------

/**
 * Series por SESIÓN y grupo, promediadas entre los días de la rutina.
 *
 * Se hace por sesión y no por semana a propósito: así, cuando una semana tiene
 * menos entrenos previstos —una descarga, por ejemplo— lo previsto baja solo,
 * sin que nadie tenga que reprogramar nada. Es la mejor aproximación posible
 * mientras la rutina no sepa distinguir la semana 1 de la 3.
 */
function seriesPorSesion(
  routine: Routine | null,
  muscleByExercise: Record<string, string>
): { byGroup: Record<string, number>; sessionsPerWeek: number | null } {
  if (!routine || routine.days.length === 0) return { byGroup: {}, sessionsPerWeek: null };

  const dias = routine.days.filter((d) => !d.isRest && d.exercises.length > 0);
  if (dias.length === 0) return { byGroup: {}, sessionsPerWeek: null };

  const total: Record<string, number> = {};
  for (const dia of dias) {
    for (const ex of dia.exercises) {
      const grupo = ex.muscleGroup || muscleByExercise[ex.exerciseId] || 'Otros';
      total[grupo] = (total[grupo] ?? 0) + (ex.sets || 0);
    }
  }
  const byGroup: Record<string, number> = {};
  for (const [g, n] of Object.entries(total)) byGroup[g] = n / dias.length;

  // Cuántas veces por semana se entrena, según el modo de programación.
  let sessionsPerWeek: number | null;
  if (routine.schedule === 'flex') {
    // A sensaciones no hay nada previsto: el alumno elige cada día.
    sessionsPerWeek = null;
  } else if (routine.schedule === 'cycle') {
    // Ciclo rotatorio (Día 1..N, descansos incluidos): la semana no encaja con
    // el ciclo, así que se prorratea.
    sessionsPerWeek = (7 * dias.length) / routine.days.length;
  } else {
    const conDia = dias.filter((d) => d.weekday !== undefined).length;
    sessionsPerWeek = conDia > 0 ? conDia : dias.length;
  }

  return { byGroup, sessionsPerWeek };
}

// ---------------------------------------------------------------------------
// Lo hecho, sacado de los entrenos
// ---------------------------------------------------------------------------

function seriesHechas(
  logs: WorkoutLog[],
  muscleByExercise: Record<string, string>
): { porGrupo: Record<string, number>; dias: Set<number> } {
  const porGrupo: Record<string, number> = {};
  const dias = new Set<number>();
  for (const log of logs) {
    let algo = false;
    for (const ex of log.exercises) {
      const hechas = ex.sets.filter((s) => s.completed).length;
      if (hechas === 0) continue;
      algo = true;
      const grupo = muscleByExercise[ex.exerciseId] || 'Otros';
      porGrupo[grupo] = (porGrupo[grupo] ?? 0) + hechas;
    }
    // Dos entrenos el mismo día son una sesión doble, no dos días de frecuencia.
    if (algo) dias.add(startOfDayLocal(log.date));
  }
  return { porGrupo, dias };
}

function startOfDayLocal(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ---------------------------------------------------------------------------
// La mejor progresión del bloque (el aviso que no regaña)
// ---------------------------------------------------------------------------

interface Marca {
  reps: number;
  weight: number;
  seconds: boolean;
}

function mejorSerie(log: WorkoutLog, exerciseId: string, seconds: boolean): Marca | null {
  let mejor: Marca | null = null;
  for (const ex of log.exercises) {
    if (ex.exerciseId !== exerciseId) continue;
    for (const set of ex.sets) {
      if (!set.completed) continue;
      const w = toNum(set.weight);
      const peso = Number.isNaN(w) ? 0 : w;
      for (const marca of [set.reps, ...(set.clusters ?? [])]) {
        const r = parseInt(marca, 10);
        if (Number.isNaN(r) || (r === 0 && peso === 0)) continue;
        const cand = { reps: r, weight: seconds ? 0 : peso, seconds };
        if (!mejor || puntua(cand) > puntua(mejor)) mejor = cand;
      }
    }
  }
  return mejor;
}

const puntua = (m: Marca) => (m.seconds ? m.reps : m.weight * 1000 + m.reps);

function formatMarca(m: Marca): string {
  if (m.seconds) return `${m.reps}s`;
  return m.weight > 0 ? `${m.reps}×${m.weight}` : `${m.reps}`;
}

/**
 * El ejercicio que más ha subido dentro del bloque: primera marca contra
 * última. Sin esto el panel solo regaña, y un panel que solo regaña se cierra.
 */
function mejorProgreso(
  logs: WorkoutLog[],
  measureByExercise: Record<string, string>
): BlockAlert | null {
  const ordenados = [...logs].sort((a, b) => a.date - b.date);
  const ids = new Map<string, string>();
  for (const log of ordenados) for (const ex of log.exercises) ids.set(ex.exerciseId, ex.name);

  let mejor: { nombre: string; de: Marca; a: Marca; ganancia: number } | null = null;
  for (const [id, nombre] of ids) {
    const seconds = measureByExercise[id] === 'seconds';
    const conDatos = ordenados
      .map((l) => ({ fecha: l.date, marca: mejorSerie(l, id, seconds) }))
      .filter((x) => x.marca !== null) as { fecha: number; marca: Marca }[];
    // Con menos de tres sesiones, "mejorar" puede ser simplemente un buen día.
    if (conDatos.length < 3) continue;

    const de = conDatos[0].marca;
    const a = conDatos[conDatos.length - 1].marca;
    const antes = puntua(de);
    const despues = puntua(a);
    if (despues <= antes) continue;
    const ganancia = (despues - antes) / Math.max(1, antes);
    if (!mejor || ganancia > mejor.ganancia) mejor = { nombre, de, a, ganancia };
  }

  if (!mejor) return null;
  return {
    id: 'progreso',
    tone: 'good',
    title: `${mejor.nombre}: de ${formatMarca(mejor.de)} a ${formatMarca(mejor.a)}`,
    detail: 'Es la mejor progresión del bloque.',
  };
}

// ---------------------------------------------------------------------------
// La vista
// ---------------------------------------------------------------------------

export interface BlockViewInput {
  /** Bloque a analizar. Sin ciclo, se miran las últimas semanas naturales. */
  cycle?: TrainingCycle | null;
  /** Todos los ciclos del alumno (para resolver las semanas del plan). */
  cycles?: TrainingCycle[];
  logs: WorkoutLog[];
  routine: Routine | null;
  muscleByExercise: Record<string, string>;
  measureByExercise?: Record<string, string>;
  /** Semanas a mirar cuando no hay ciclo. */
  weeks?: number;
  now?: number;
}

export function buildBlockView({
  cycle = null,
  cycles = [],
  logs,
  routine,
  muscleByExercise,
  measureByExercise = {},
  weeks = 4,
  now = Date.now(),
}: BlockViewInput): BlockView {
  const { byGroup: porSesion, sessionsPerWeek } = seriesPorSesion(routine, muscleByExercise);
  const hasPlan = sessionsPerWeek !== null && Object.keys(porSesion).length > 0;

  // Semanas del bloque. Con ciclo se reutiliza el calendario del plan (que ya
  // sabe de descargas y de metas); sin ciclo, las últimas semanas naturales.
  const semanas: BlockWeek[] = [];
  if (cycle) {
    for (const w of planCalendar(cycle, [cycle, ...cycles], logs, now)) {
      semanas.push({
        start: w.start,
        end: w.end,
        index: w.index,
        label: `S${w.index}`,
        isDeload: w.isDeload,
        sessionsPlanned: w.target ?? (sessionsPerWeek != null ? Math.round(sessionsPerWeek) : null),
        sessionsDone: w.done,
        isCurrent: w.isCurrent,
        isPast: w.isPast,
        isFuture: !w.isPast && !w.isCurrent,
      });
    }
  } else {
    const actual = startOfWeek(now);
    for (let i = weeks - 1; i >= 0; i--) {
      const start = actual - i * 7 * DAY_MS;
      semanas.push({
        start,
        end: start + 6 * DAY_MS,
        index: weeks - i,
        label: etiquetaCorta(start),
        isDeload: false,
        sessionsPlanned: sessionsPerWeek != null ? Math.round(sessionsPerWeek) : null,
        sessionsDone: 0,
        isCurrent: i === 0,
        isPast: i > 0,
        isFuture: false,
      });
    }
  }

  // Series hechas, semana a semana.
  const porSemana = semanas.map((s) =>
    seriesHechas(
      logs.filter((l) => l.date >= s.start && l.date < s.end + DAY_MS),
      muscleByExercise
    )
  );
  semanas.forEach((s, i) => {
    if (!cycle) s.sessionsDone = porSemana[i].dias.size;
  });

  // Filas: todo grupo que aparezca en la rutina o en los entrenos. Los que
  // están programados y a cero son justo los que hay que ver, así que no se
  // filtran por "sin datos".
  const grupos = new Set<string>([...Object.keys(porSesion)]);
  for (const p of porSemana) for (const g of Object.keys(p.porGrupo)) grupos.add(g);

  const rows: BlockRow[] = [...grupos].map((group) => {
    const planned = semanas.map((s) =>
      porSesion[group] != null && s.sessionsPlanned != null
        ? Math.round(porSesion[group] * s.sessionsPlanned)
        : null
    );
    const done = porSemana.map((p) => p.porGrupo[group] ?? 0);
    return {
      group,
      planned,
      done,
      totalPlanned: planned.reduce<number>((n, v) => n + (v ?? 0), 0),
      totalDone: done.reduce((n, v) => n + v, 0),
    };
  });
  rows.sort((a, b) => b.totalPlanned + b.totalDone - (a.totalPlanned + a.totalDone));

  // El cumplimiento solo cuenta las semanas cerradas y la que se está viviendo.
  // Incluir las que aún no han empezado deja a cualquiera al 25 % el primer
  // lunes del bloque, que es la forma más rápida de que nadie mire el número.
  const vividas = semanas.map((s) => !s.isFuture);
  const totalDone = rows.reduce(
    (n, r) => n + r.done.reduce((m, v, i) => m + (vividas[i] ? v : 0), 0),
    0
  );
  const totalPlanned = rows.reduce(
    (n, r) => n + r.planned.reduce<number>((m, v, i) => m + (vividas[i] ? (v ?? 0) : 0), 0),
    0
  );

  return {
    weeks: semanas,
    rows,
    alerts: avisos(semanas, rows, logs, measureByExercise),
    adherence: totalPlanned > 0 ? Math.min(1, totalDone / totalPlanned) : null,
    totalDone,
    totalPlanned,
    hasPlan,
  };
}

function etiquetaCorta(ts: number): string {
  return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

/**
 * Los avisos.
 *
 * Como mucho tres, y ninguno opinable: un aviso que un entrenador serio
 * considera una tontería quema la confianza en todos los demás. Por eso los
 * umbrales son generosos (un desequilibrio tiene que ser grande de verdad) y
 * siempre se intenta cerrar con lo que ha ido bien.
 */
function avisos(
  semanas: BlockWeek[],
  rows: BlockRow[],
  logs: WorkoutLog[],
  measureByExercise: Record<string, string>
): BlockAlert[] {
  const malos: BlockAlert[] = [];

  // 1. Programados y sin tocar en todo el bloque, TODOS en un solo aviso: tres
  // tarjetas seguidas diciendo lo mismo con distinto nombre no informan más,
  // solo empujan hacia abajo lo siguiente.
  const aCero = rows.filter((r) => r.totalPlanned >= 4 && r.totalDone === 0);
  if (aCero.length > 0) {
    const nombres = aCero.slice(0, 3).map((r) => r.group);
    const resto = aCero.length - nombres.length;
    const lista =
      nombres.length === 1
        ? nombres[0]
        : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
    const previstas = aCero.reduce((n, r) => n + r.totalPlanned, 0);
    malos.push({
      id: 'cero',
      tone: 'bad',
      title: `${lista}${resto > 0 ? ` y ${resto} más` : ''}: 0 series`,
      detail: `Estaban previstas ${previstas} en el bloque y no ha hecho ninguna.`,
    });
  }

  // 2. Desequilibrio empuje/tirón.
  //
  // Se mide sobre lo PREVISTO cuando hay plan, porque es lo que el entrenador
  // controla y puede corregir. Si el plan está equilibrado y el desequilibrio
  // aparece solo en lo hecho, el problema no es la programación sino que se
  // salta un día — y eso se dice con otras palabras, o no se dice si esa
  // semana ya se ha reportado como caída (sería el mismo aviso dos veces).
  const empujeRow = rows.find((r) => r.group === 'Empuje');
  const tironRow = rows.find((r) => r.group === 'Tirón');
  const semanaCaida = peorSemanaCaida(semanas);

  if (empujeRow && tironRow) {
    const planEmpuje = empujeRow.totalPlanned;
    const planTiron = tironRow.totalPlanned;
    const hayPlan = planEmpuje > 0 && planTiron > 0;
    const ratioPlan = hayPlan ? Math.max(planEmpuje, planTiron) / Math.min(planEmpuje, planTiron) : 0;

    const hechoEmpuje = empujeRow.totalDone;
    const hechoTiron = tironRow.totalDone;
    const mayor = Math.max(hechoEmpuje, hechoTiron);
    const menor = Math.min(hechoEmpuje, hechoTiron);
    const ratioHecho = menor > 0 ? mayor / menor : Infinity;

    if (hayPlan && ratioPlan >= 1.6 && Math.max(planEmpuje, planTiron) >= 12) {
      const mas = planEmpuje > planTiron ? 'Empuje' : 'Tirón';
      const menos = planEmpuje > planTiron ? 'tirón' : 'empuje';
      malos.push({
        id: 'desequilibrio',
        tone: 'warn',
        title: `El plan pide mucho más ${mas.toLowerCase()} que ${menos}`,
        detail: `${Math.max(planEmpuje, planTiron)} series previstas contra ${Math.min(planEmpuje, planTiron)}.`,
      });
    } else if (!hayPlan && mayor >= 12 && menor > 0 && ratioHecho >= 1.6) {
      const mas = hechoEmpuje > hechoTiron ? 'Empuje' : 'Tirón';
      const menos = hechoEmpuje > hechoTiron ? 'tirón' : 'empuje';
      malos.push({
        id: 'desequilibrio',
        tone: 'warn',
        title: `${mas} muy por encima del ${menos}`,
        detail: `${mayor} series contra ${menor} en todo el bloque.`,
      });
    } else if (hayPlan && !semanaCaida && mayor >= 12 && ratioHecho >= 1.6) {
      // El plan estaba bien; lo que falla es que un día no se hace.
      const flojo = hechoEmpuje > hechoTiron ? 'tirón' : 'empuje';
      malos.push({
        id: 'se-salta',
        tone: 'warn',
        title: `Se salta el ${flojo}`,
        detail: `El plan está equilibrado, pero ha hecho ${mayor} series contra ${menor}.`,
      });
    }
  }

  // 3. Descarga que no descargó.
  for (let i = 1; i < semanas.length; i++) {
    if (!semanas[i].isDeload || !semanas[i].isPast) continue;
    const ahora = rows.reduce((n, r) => n + r.done[i], 0);
    const antes = rows.reduce((n, r) => n + r.done[i - 1], 0);
    if (antes > 0 && ahora >= antes) {
      malos.push({
        id: `descarga-${i}`,
        tone: 'warn',
        title: 'La descarga no descargó',
        detail: `${semanas[i].label}: ${ahora} series, y la semana anterior ${antes}.`,
      });
    }
  }

  // 4. La peor semana caída (solo una, y solo si ya terminó).
  if (semanaCaida) {
    malos.push({
      id: 'semana-caida',
      tone: 'warn',
      title: `${semanaCaida.label}: ${semanaCaida.sessionsDone} de ${semanaCaida.sessionsPlanned} entrenos`,
      detail: 'Esa semana se cayó; el resto del bloque va aparte.',
    });
  }

  // Dos problemas y una buena noticia. Con más, se convierte en una lista que
  // nadie lee, y el que importaba queda enterrado en el tercer puesto.
  const bueno = mejorProgreso(logs, measureByExercise);
  const salida = malos.slice(0, bueno ? 2 : 3);
  if (bueno) salida.push(bueno);
  return salida;
}

/** La semana pasada que menos se cumplió (la mitad o menos de lo previsto). */
function peorSemanaCaida(semanas: BlockWeek[]): BlockWeek | null {
  let peor: { s: BlockWeek; falta: number } | null = null;
  for (const s of semanas) {
    if (!s.isPast || !s.sessionsPlanned) continue;
    if (s.sessionsDone * 2 > s.sessionsPlanned) continue;
    const falta = s.sessionsPlanned - s.sessionsDone;
    if (!peor || falta > peor.falta) peor = { s, falta };
  }
  return peor?.s ?? null;
}
