import { diaMes, fechaLegible, inicioDeLaSemana, masDias, mayusculaInicial } from './fechas';
import { setsByMuscleGroup, weeklyExerciseMatrix, workoutsByMonth, type MatrixCell, type MatrixRow } from './stats';
import { UDECA_LOGO_DATA_URI } from './udecaLogo';
import type { Routine, UserProfile, WeightLog, WorkoutLog } from './types';

/**
 * Informe de progreso en PDF.
 *
 * Es el documento que el entrenador entrega —o el alumno enseña— cuando quiere
 * ver de dónde viene y hacia dónde va. Por eso la pieza central no son los
 * totales, sino CUÁNTO ha mejorado cada ejercicio: de qué marca partía, en cuál
 * está ahora y cuál es la mejor que ha hecho.
 *
 * Va en claro y no con el fondo oscuro de la app a propósito. Un PDF acaba
 * impreso o abierto en un visor cualquiera, y los navegadores no imprimen los
 * fondos salvo que se les insista: con el diseño oscuro salía texto blanco sobre
 * papel blanco, es decir, una hoja en blanco.
 */

const GOLD = '#96702A';
const GOLD_SOFT = '#C9902B';
const INK = '#14161B';
const MUTED = '#6C727C';
const HAIRLINE = '#E4E6EA';
const UP = '#1F7A46';
const DOWN = '#B3261E';

/** Columnas de semana que caben en un A4 sin apretar los números. */
const MAX_WEEK_COLS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ClientReportData {
  client: UserProfile;
  routine: Routine | null;
  weightLogs: WeightLog[];
  workoutLogs: WorkoutLog[];
  /** exerciseId → grupo muscular (biblioteca del coach), para empuje/tirón. */
  muscleByExercise?: Record<string, string>;
  /** exerciseId → medida ('reps' | 'seconds') de la biblioteca. */
  measureByExercise?: Record<string, string>;
  /**
   * Ejercicios seguidos, en el mismo orden que la tabla de la pantalla. El
   * informe tiene que ser lo que se está mirando, no otra selección distinta.
   */
  exerciseIds?: string[];
  /** Semanas que abarca el informe (las del selector de la pantalla). */
  weeks?: number;
  /** Quién firma el informe. */
  coachName?: string;
}

interface Mark {
  name: string;
  value: number;
}

/** Primer número de un texto de reps/segundos ("8-12" → 8, "60s" → 60). */
function parseNum(v: string): number {
  const m = String(v).match(/\d+(?:[.,]\d+)?/);
  return m ? parseFloat(m[0].replace(',', '.')) : 0;
}

/** Mejores marcas de un patrón (Empuje/Tirón): mejor reps y mejor isométrico. */
export function bestMarks(
  logs: WorkoutLog[],
  group: 'Empuje' | 'Tirón',
  muscle: Record<string, string>,
  measure: Record<string, string>
): { reps: Mark | null; secs: Mark | null } {
  let reps: Mark | null = null;
  let secs: Mark | null = null;
  for (const log of logs) {
    for (const ex of log.exercises) {
      if (muscle[ex.exerciseId] !== group) continue;
      const isSec = measure[ex.exerciseId] === 'seconds' || ex.measure === 'seconds';
      for (const set of ex.sets) {
        if (!set.completed) continue;
        const n = parseNum(set.reps);
        if (n <= 0) continue;
        if (isSec) {
          if (!secs || n > secs.value) secs = { name: ex.name, value: n };
        } else if (!reps || n > reps.value) {
          reps = { name: ex.name, value: n };
        }
      }
    }
  }
  return { reps, secs };
}

// ---------------------------------------------------------------------------
// Mejoría por ejercicio
// ---------------------------------------------------------------------------

type Direction = 'up' | 'down' | 'flat' | 'none';

interface Improvement {
  row: MatrixRow;
  first: MatrixCell | null;
  last: MatrixCell | null;
  best: MatrixCell | null;
  /** Cuánto ha cambiado, dicho en las unidades que han cambiado. */
  delta: string;
  dir: Direction;
}

const es = (n: number) => n.toLocaleString('es-ES');
const signo = (n: number) => (n > 0 ? `+${es(n)}` : es(n));

/**
 * Diferencia entre la primera marca del periodo y la última, contada en lo que
 * de verdad ha cambiado.
 *
 * No se inventa un porcentaje único cuando se mueven dos variables a la vez: de
 * 8×20 kg a 10×25 kg se dice "+2 reps · +5 kg", no un tanto por ciento que
 * mezcla peso con repeticiones y no significa nada.
 */
function describeChange(
  first: MatrixCell | null,
  last: MatrixCell | null,
  measure: 'reps' | 'seconds'
): { delta: string; dir: Direction } {
  if (!first || !last) return { delta: '—', dir: 'none' };
  if (first === last) return { delta: 'Marca inicial', dir: 'none' };

  const dir: Direction =
    last.score > first.score ? 'up' : last.score < first.score ? 'down' : 'flat';

  if (measure === 'seconds') {
    const d = last.reps - first.reps;
    if (d === 0) return { delta: 'Se mantiene', dir };
    const pct = first.reps > 0 ? Math.round((d / first.reps) * 100) : null;
    return { delta: `${signo(d)} s${pct !== null ? ` (${signo(pct)}%)` : ''}`, dir };
  }

  const dReps = last.reps - first.reps;
  const dPeso = last.weight - first.weight;
  if (dReps === 0 && dPeso === 0) return { delta: 'Se mantiene', dir };
  // Solo repeticiones (peso corporal): el porcentaje sí es honesto.
  if (dPeso === 0 && first.weight === 0) {
    const pct = first.reps > 0 ? Math.round((dReps / first.reps) * 100) : null;
    return { delta: `${signo(dReps)} reps${pct !== null ? ` (${signo(pct)}%)` : ''}`, dir };
  }
  const partes: string[] = [];
  if (dReps !== 0) partes.push(`${signo(dReps)} reps`);
  if (dPeso !== 0) partes.push(`${signo(dPeso)} kg`);
  return { delta: partes.join(' · '), dir };
}

function improvementsOf(rows: MatrixRow[]): Improvement[] {
  return rows.map((row) => {
    const llenas = row.cells.filter((c): c is MatrixCell => c !== null);
    const first = llenas[0] ?? null;
    const last = llenas[llenas.length - 1] ?? null;
    const best =
      llenas.length > 0
        ? llenas.reduce((a, b) => (b.score > a.score ? b : a))
        : null;
    return { row, first, last, best, ...describeChange(first, last, row.measure) };
  });
}

// ---------------------------------------------------------------------------
// Dibujo
// ---------------------------------------------------------------------------

/** Línea de evolución diminuta. Dice de un vistazo si sube, baja o serpentea. */
function sparkline(values: (number | null)[], w = 66, h = 18, color = GOLD_SOFT): string {
  const puntos = values
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v !== null);
  if (puntos.length < 2) return '';
  const min = Math.min(...puntos.map((p) => p.v));
  const max = Math.max(...puntos.map((p) => p.v));
  const span = max - min || 1;
  const n = Math.max(1, values.length - 1);
  const xy = (p: { v: number; i: number }) => ({
    x: (p.i / n) * (w - 4) + 2,
    y: h - 2 - ((p.v - min) / span) * (h - 4),
  });
  const d = puntos.map((p) => { const q = xy(p); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; });
  const fin = xy(puntos[puntos.length - 1]);
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <polyline points="${d.join(' ')}" fill="none" stroke="${color}" stroke-width="1.6"
      stroke-linejoin="round" stroke-linecap="round" />
    <circle cx="${fin.x.toFixed(1)}" cy="${fin.y.toFixed(1)}" r="2.1" fill="${color}" />
  </svg>`;
}

const ARROW: Record<Direction, string> = {
  up: `<span class="dir up">▲</span>`,
  down: `<span class="dir down">▼</span>`,
  flat: `<span class="dir flat">—</span>`,
  none: '',
};

const fmtKg = (n: number) => `${n.toFixed(1).replace('.', ',')} kg`;

/**
 * Informe de progreso con la identidad de UDECA: resumen del periodo, mejoría
 * ejercicio por ejercicio, la tabla semana a semana que se ve en pantalla,
 * reparto de trabajo, peso corporal y rutina en vigor.
 */
export function buildClientReportHtml(data: ClientReportData): string {
  const {
    client,
    routine,
    weightLogs,
    workoutLogs,
    muscleByExercise = {},
    measureByExercise = {},
    exerciseIds,
    weeks = 8,
    coachName,
  } = data;

  // ----- Periodo -----
  const semanas = Math.max(1, Math.round(weeks));
  const desde = masDias(inicioDeLaSemana(Date.now()), -7 * (semanas - 1));
  const hasta = Date.now();
  // Todo el informe habla del MISMO periodo que la tabla de la pantalla: si no,
  // los totales de arriba no cuadrarían con las columnas de abajo.
  const logs = workoutLogs.filter((l) => l.date >= desde);

  // ----- Resumen del periodo -----
  const sesiones = logs.length;
  const diasClave = [...new Set(logs.map((l) => new Date(l.date).toDateString()))];
  const diasEntrenados = diasClave.length;
  const minutos = logs.reduce((s, l) => s + (l.durationMin ?? 0), 0);
  const horas = minutos > 0 ? `${(minutos / 60).toFixed(1).replace('.', ',')} h` : '—';
  const seriesHechas = logs.reduce(
    (s, l) => s + l.exercises.reduce((a, e) => a + e.sets.filter((x) => x.completed).length, 0),
    0
  );
  const mediaSemanal = (sesiones / semanas).toFixed(1).replace('.', ',');

  const tiempos = diasClave.map((k) => new Date(k).getTime()).sort((a, b) => a - b);
  let descansoMedio = '—';
  if (tiempos.length >= 2) {
    const huecos: number[] = [];
    for (let i = 1; i < tiempos.length; i++) huecos.push((tiempos[i] - tiempos[i - 1]) / DAY_MS);
    const media = Math.max(0, huecos.reduce((s, g) => s + g, 0) / huecos.length - 1);
    descansoMedio = `${media.toFixed(1).replace('.', ',')} d`;
  }

  // ----- Matriz semanal (la misma que la pantalla) -----
  const matriz = weeklyExerciseMatrix(logs, semanas, measureByExercise);
  const porId = new Map(matriz.rows.map((r) => [r.exerciseId, r]));
  const filas = exerciseIds
    ? exerciseIds.map((id) => porId.get(id)).filter((r): r is MatrixRow => Boolean(r))
    : matriz.rows;
  const mejoras = improvementsOf(filas);
  const suben = mejoras.filter((m) => m.dir === 'up').length;
  const bajan = mejoras.filter((m) => m.dir === 'down').length;
  const igual = mejoras.filter((m) => m.dir === 'flat').length;

  // ----- Mejores marcas por patrón -----
  const push = bestMarks(logs, 'Empuje', muscleByExercise, measureByExercise);
  const pull = bestMarks(logs, 'Tirón', muscleByExercise, measureByExercise);
  const hayPatrones = Boolean(push.reps || push.secs || pull.reps || pull.secs);
  const marca = (label: string, m: Mark | null, unidad: string) =>
    `<div class="mark">
       <span class="mark-label">${label}</span>
       <span class="mark-value">${m ? `${es(m.value)}${unidad}` : '—'}</span>
       <span class="mark-name">${m ? escapeHtml(m.name) : 'Sin registros'}</span>
     </div>`;

  // ----- Tabla semana a semana -----
  const desdeCol = Math.max(0, matriz.weekStarts.length - MAX_WEEK_COLS);
  const columnas = matriz.weekStarts.slice(desdeCol);
  const celdaTabla = (cells: (MatrixCell | null)[], i: number) => {
    const c = cells[desdeCol + i];
    if (!c) return `<td class="wk empty">·</td>`;
    const prev = anterior(cells, desdeCol + i);
    const flecha = prev
      ? c.score > prev.score
        ? ARROW.up
        : c.score < prev.score
          ? ARROW.down
          : ''
      : '';
    return `<td class="wk"><b>${escapeHtml(c.label)}</b>${flecha}${
      c.alt ? `<i class="alt">${escapeHtml(c.alt)}</i>` : ''
    }</td>`;
  };
  const tablaSemanas = filas.length
    ? `<table class="grid">
        <thead><tr><th class="ex">Ejercicio</th>${columnas
          .map((w, i) => `<th class="wk${i === columnas.length - 1 ? ' now' : ''}">${diaMes(w)}</th>`)
          .join('')}</tr></thead>
        <tbody>${filas
          .map(
            (r) =>
              `<tr><td class="ex">${escapeHtml(r.name)}</td>${columnas
                .map((_, i) => celdaTabla(r.cells, i))
                .join('')}</tr>`
          )
          .join('')}</tbody>
       </table>`
    : '';

  // ----- Meses -----
  const meses = workoutsByMonth(logs, measureByExercise)
    .slice(0, 6)
    .map((m) => {
      const label = mayusculaInicial(m.label);
      return `<tr>
        <td>${escapeHtml(label)}</td>
        <td class="num">${m.sessions.length}</td>
        <td class="num">${es(m.totalSets)}</td>
        <td class="num">${es(m.totalReps)}</td>
        <td class="num">${m.totalSeconds > 0 ? `${es(m.totalSeconds)} s` : '—'}</td>
        <td class="num">${m.volumeKg > 0 ? `${es(Math.round(m.volumeKg))} kg` : '—'}</td>
      </tr>`;
    })
    .join('');

  // ----- Reparto por grupo muscular -----
  const grupos = setsByMuscleGroup(logs, muscleByExercise, semanas * 7);
  const maxGrupo = grupos[0]?.sets ?? 0;
  const totalGrupos = grupos.reduce((s, g) => s + g.sets, 0);
  const barras = grupos
    .slice(0, 8)
    .map(
      (g) => `<div class="bar-row">
        <span class="bar-label">${escapeHtml(g.group)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${
          maxGrupo ? Math.round((g.sets / maxGrupo) * 100) : 0
        }%"></span></span>
        <span class="bar-value">${es(g.sets)} series · ${
          totalGrupos ? Math.round((g.sets / totalGrupos) * 100) : 0
        }%</span>
      </div>`
    )
    .join('');

  // ----- Peso corporal -----
  const pesos = [...weightLogs].sort((a, b) => a.date - b.date);
  const pesosPeriodo = pesos.filter((w) => w.date >= desde);
  const primerPeso = pesosPeriodo[0] ?? pesos[0];
  const ultimoPeso = pesos[pesos.length - 1];
  const cambioPeso =
    primerPeso && ultimoPeso ? ultimoPeso.weightKg - primerPeso.weightKg : null;

  const diasRutina = routine
    ? routine.days
        .map(
          (d) =>
            `<tr><td>${escapeHtml(d.name)}</td><td>${
              d.isRest
                ? 'Descanso'
                : `${d.exercises.length} ejercicios · ${d.exercises.reduce(
                    (a, e) => a + (e.sets || 0),
                    0
                  )} series`
            }</td></tr>`
        )
        .join('')
    : '';

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Informe de progreso · ${escapeHtml(client.name)}</title>
    <style>
      @page { size: A4; margin: 13mm 12mm 12mm; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body {
        margin: 0; background: #FFFFFF; color: ${INK};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
        font-size: 11px; line-height: 1.45; -webkit-font-smoothing: antialiased;
      }
      .sheet { max-width: 186mm; margin: 0 auto; }

      /* Cabecera */
      .head { display: flex; align-items: flex-start; gap: 14px; border-bottom: 2px solid ${GOLD}; padding-bottom: 14px; }
      .head img { width: 46px; height: 46px; }
      .head .who { flex: 1; }
      .brand { font-size: 9px; letter-spacing: 3.4px; text-transform: uppercase; color: ${GOLD}; font-weight: 700; }
      h1 { font-family: Georgia, 'Times New Roman', serif; font-size: 25px; letter-spacing: .4px; margin: 3px 0 2px; }
      .sub { color: ${MUTED}; font-size: 10.5px; }
      .stamp { text-align: right; color: ${MUTED}; font-size: 9.5px; line-height: 1.6; white-space: nowrap; }
      .stamp b { display: block; color: ${INK}; font-size: 10.5px; }

      /* Secciones */
      /* Las secciones pueden partirse entre páginas (una tabla larga tiene que
         poder seguir en la siguiente), pero nunca por sitios feos: ni un título
         suelto al final de la hoja ni una fila cortada por la mitad. */
      section { margin-top: 20px; }
      h2, .tiles, .cols, .bar-row, .weight { break-inside: avoid; }
      h2 { break-after: avoid; }
      tr { break-inside: avoid; }
      h2 {
        font-family: Georgia, 'Times New Roman', serif; font-size: 12px; letter-spacing: 2.2px;
        text-transform: uppercase; color: ${GOLD}; margin: 0 0 9px;
        border-bottom: 1px solid ${HAIRLINE}; padding-bottom: 6px; font-weight: 700;
      }
      .note { color: ${MUTED}; font-size: 9.5px; margin: 7px 0 0; }

      /* Cifras */
      .tiles { display: flex; gap: 7px; }
      .tile { flex: 1; border: 1px solid ${HAIRLINE}; border-radius: 8px; padding: 9px 6px; text-align: center; }
      .tile b { display: block; font-size: 19px; font-weight: 700; color: ${INK}; letter-spacing: -.4px; }
      .tile span { display: block; font-size: 8px; letter-spacing: .9px; text-transform: uppercase; color: ${MUTED}; margin-top: 2px; }
      .verdict { margin-top: 9px; font-size: 11px; color: ${INK}; }
      .verdict b.up { color: ${UP}; } .verdict b.down { color: ${DOWN}; }

      /* Tablas */
      table { width: 100%; border-collapse: collapse; }
      thead { display: table-header-group; }
      th, td { text-align: left; padding: 5px 7px; border-bottom: 1px solid ${HAIRLINE}; vertical-align: middle; }
      th { font-size: 8px; letter-spacing: 1px; text-transform: uppercase; color: ${MUTED}; font-weight: 600; background: #FAFAFB; }
      td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
      tbody tr:nth-child(even) td { background: #FCFCFD; }

      /* Mejoría por ejercicio */
      .imp { table-layout: fixed; }
      .imp td.name { font-weight: 600; }
      .imp th.ev, .imp td.ev { width: 78px; }
      .imp th.val, .imp td.val { width: 62px; }
      .imp td.val { font-variant-numeric: tabular-nums; white-space: nowrap; }
      .imp td.best { color: ${GOLD}; font-weight: 700; white-space: nowrap; }
      .imp th.chg, .imp td.delta { width: 122px; }
      .imp td.delta { font-weight: 600; }
      .imp th.wks, .imp td.wks { width: 54px; }
      .imp td.delta.up { color: ${UP}; } .imp td.delta.down { color: ${DOWN}; }
      .imp td.delta.flat, .imp td.delta.none { color: ${MUTED}; font-weight: 500; }
      .spark { vertical-align: middle; }

      /* Rejilla semanal */
      .grid th.ex, .grid td.ex { width: 30%; }
      .grid td.ex { font-weight: 600; font-size: 10px; }
      .grid th.wk, .grid td.wk { text-align: center; font-variant-numeric: tabular-nums; padding: 5px 2px; }
      .grid th.wk { font-size: 7.5px; letter-spacing: .4px; }
      .grid th.wk.now { color: ${GOLD}; }
      .grid td.wk b { font-size: 10.5px; font-weight: 700; }
      .grid td.wk i { display: block; font-style: normal; font-size: 8px; color: ${MUTED}; }
      .grid td.empty { color: #C7CBD2; }
      .dir { font-size: 7px; margin-left: 2px; vertical-align: 1px; }
      .dir.up { color: ${UP}; } .dir.down { color: ${DOWN}; } .dir.flat { color: ${MUTED}; }

      /* Marcas por patrón */
      .cols { display: flex; gap: 8px; }
      .col { flex: 1; border: 1px solid ${HAIRLINE}; border-radius: 8px; padding: 10px 12px; }
      .col h3 { margin: 0 0 7px; font-size: 9px; letter-spacing: 1.4px; text-transform: uppercase; color: ${MUTED}; }
      .mark { display: flex; align-items: baseline; gap: 7px; padding: 3px 0; }
      .mark-label { font-size: 9px; color: ${MUTED}; width: 62px; }
      .mark-value { font-size: 14px; font-weight: 700; color: ${GOLD}; font-variant-numeric: tabular-nums; }
      .mark-name { font-size: 9.5px; color: ${INK}; }

      /* Barras de reparto */
      .bar-row { display: flex; align-items: center; gap: 9px; padding: 3px 0; }
      .bar-label { width: 96px; font-size: 10px; }
      .bar-track { flex: 1; height: 7px; background: #F0F1F4; border-radius: 4px; overflow: hidden; }
      .bar-fill { display: block; height: 100%; background: ${GOLD_SOFT}; border-radius: 4px; }
      .bar-value { width: 108px; text-align: right; font-size: 9px; color: ${MUTED}; font-variant-numeric: tabular-nums; }

      /* Peso */
      .weight { display: flex; align-items: center; gap: 18px; }
      .weight .big { font-size: 22px; font-weight: 700; }
      .weight .chg { font-size: 12px; font-weight: 700; }
      /* El peso no se pinta de verde ni de rojo: subir o bajar no es bueno ni
         malo por sí mismo, depende del objetivo de cada uno. */
      .weight .chg { color: ${MUTED}; }

      .foot { margin-top: 24px; padding-top: 9px; border-top: 1px solid ${HAIRLINE};
              display: flex; justify-content: space-between; color: ${MUTED}; font-size: 8.5px;
              letter-spacing: 1px; text-transform: uppercase; }
      .empty-note { color: ${MUTED}; font-size: 10px; }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="head">
        <img src="${UDECA_LOGO_DATA_URI}" alt="" />
        <div class="who">
          <div class="brand">UDECA · Universidad de Calistenia</div>
          <h1>${escapeHtml(client.name)}</h1>
          <div class="sub">Informe de progreso${
            client.level ? ` · ${escapeHtml(client.level)}` : ''
          }${client.goal ? ` · Objetivo: ${escapeHtml(client.goal)}` : ''}</div>
        </div>
        <div class="stamp">
          <b>${fechaLegible(desde)} — ${fechaLegible(hasta)}</b>
          ${semanas} ${semanas === 1 ? 'semana' : 'semanas'}<br />
          Emitido el ${fechaLegible(Date.now())}${
            coachName ? `<br />por ${escapeHtml(coachName)}` : ''
          }
        </div>
      </div>

      <section>
        <h2>El periodo en cifras</h2>
        <div class="tiles">
          <div class="tile"><b>${sesiones}</b><span>Sesiones</span></div>
          <div class="tile"><b>${diasEntrenados}</b><span>Días</span></div>
          <div class="tile"><b>${mediaSemanal}</b><span>Sesiones/semana</span></div>
          <div class="tile"><b>${es(seriesHechas)}</b><span>Series</span></div>
          <div class="tile"><b>${horas}</b><span>Tiempo</span></div>
          <div class="tile"><b>${descansoMedio}</b><span>Descanso medio</span></div>
        </div>
        ${
          mejoras.length
            ? `<p class="verdict">De ${mejoras.length} ejercicios seguidos: <b class="up">${suben} mejoran</b>, ${igual} se mantienen y <b class="down">${bajan} bajan</b>.</p>`
            : ''
        }
      </section>

      <section>
        <h2>Mejoría por ejercicio</h2>
        ${
          mejoras.length
            ? `<table class="imp">
                <thead>
                  <tr>
                    <th>Ejercicio</th><th class="ev">Evolución</th><th class="val">Inicio</th>
                    <th class="val">Ahora</th><th class="val">Mejor</th><th class="chg">Cambio</th>
                    <th class="wks num">Semanas</th>
                  </tr>
                </thead>
                <tbody>
                  ${mejoras
                    .map(
                      (m) => `<tr>
                        <td class="name">${escapeHtml(m.row.name)}</td>
                        <td class="ev">${sparkline(m.row.cells.map((c) => (c ? c.score : null)))}</td>
                        <td class="val">${m.first ? escapeHtml(m.first.label) : '—'}</td>
                        <td class="val">${m.last ? escapeHtml(m.last.label) : '—'}</td>
                        <td class="val best">${m.best ? escapeHtml(m.best.label) : '—'}</td>
                        <td class="delta ${m.dir}">${ARROW[m.dir]} ${escapeHtml(m.delta)}</td>
                        <td class="wks num">${m.row.weeksActive}</td>
                      </tr>`
                    )
                    .join('')}
                </tbody>
               </table>
               <p class="note">Cada marca es una serie real, tal como se hizo: repeticiones, repeticiones×lastre o segundos. «Cambio» compara la primera semana con datos y la última.</p>`
            : '<p class="empty-note">Todavía no hay ejercicios con registros en este periodo.</p>'
        }
      </section>

      ${
        tablaSemanas
          ? `<section>
              <h2>Semana a semana</h2>
              ${tablaSemanas}
              <p class="note">La mejor serie de cada semana. ${ARROW.up} mejora sobre la semana anterior con datos, ${ARROW.down} baja. La segunda línea es la serie de más repeticiones cuando no es la misma que la más pesada.${
                desdeCol > 0 ? ` Se muestran las últimas ${MAX_WEEK_COLS} semanas del periodo.` : ''
              }</p>
             </section>`
          : ''
      }

      ${
        hayPatrones
          ? `<section>
              <h2>Mejores marcas del periodo</h2>
              <div class="cols">
                <div class="col">
                  <h3>Empuje</h3>
                  ${marca('Isométrico', push.secs, ' s')}
                  ${marca('Repeticiones', push.reps, ' reps')}
                </div>
                <div class="col">
                  <h3>Tirón</h3>
                  ${marca('Isométrico', pull.secs, ' s')}
                  ${marca('Repeticiones', pull.reps, ' reps')}
                </div>
              </div>
             </section>`
          : ''
      }

      ${
        barras
          ? `<section>
              <h2>Reparto del trabajo</h2>
              ${barras}
              <p class="note">Series completadas por grupo muscular en el periodo.</p>
             </section>`
          : ''
      }

      ${
        meses
          ? `<section>
              <h2>Volumen por mes</h2>
              <table>
                <thead><tr><th>Mes</th><th class="num">Sesiones</th><th class="num">Series</th><th class="num">Reps</th><th class="num">Isométrico</th><th class="num">Volumen</th></tr></thead>
                <tbody>${meses}</tbody>
              </table>
             </section>`
          : ''
      }

      ${
        ultimoPeso
          ? `<section>
              <h2>Peso corporal</h2>
              <div class="weight">
                <span class="big">${fmtKg(ultimoPeso.weightKg)}</span>
                ${
                  cambioPeso !== null && Math.abs(cambioPeso) >= 0.05
                    ? `<span class="chg">${
                        cambioPeso > 0 ? '+' : '−'
                      }${Math.abs(cambioPeso).toFixed(1).replace('.', ',')} kg en el periodo</span>`
                    : '<span class="chg">Estable en el periodo</span>'
                }
                ${sparkline(
                  pesosPeriodo.map((w) => w.weightKg),
                  130,
                  26
                )}
              </div>
             </section>`
          : ''
      }

      ${
        routine
          ? `<section>
              <h2>Rutina en vigor · ${escapeHtml(routine.name)}</h2>
              <table><thead><tr><th>Día</th><th>Contenido</th></tr></thead><tbody>${diasRutina}</tbody></table>
             </section>`
          : ''
      }

      <div class="foot">
        <span>UDECA · Universidad de Calistenia</span>
        <span>www.udeca.app</span>
      </div>
    </div>
  </body>
</html>`;
}

/** Celda con datos anterior a la posición `i` (para comparar la tendencia). */
function anterior(cells: (MatrixCell | null)[], i: number): MatrixCell | null {
  for (let k = i - 1; k >= 0; k--) {
    if (cells[k]) return cells[k];
  }
  return null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
