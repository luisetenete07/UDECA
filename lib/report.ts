import { workoutsByMonth } from './stats';
import type {
  NutritionPlan,
  Routine,
  UserProfile,
  WeightLog,
  WorkoutLog,
} from './types';

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Primer número de un texto de reps/segundos ("8-12" → 8, "60s" → 60). */
function parseNum(v: string): number {
  const m = String(v).match(/\d+(?:[.,]\d+)?/);
  return m ? parseFloat(m[0].replace(',', '.')) : 0;
}

export interface ClientReportData {
  client: UserProfile;
  routine: Routine | null;
  weightLogs: WeightLog[];
  workoutLogs: WorkoutLog[];
  nutritionPlan: NutritionPlan | null;
  /** exerciseId → grupo muscular (biblioteca del coach), para empuje/tirón. */
  muscleByExercise?: Record<string, string>;
  /** exerciseId → medida actual ('reps' | 'seconds') de la biblioteca. */
  measureByExercise?: Record<string, string>;
}

interface Mark {
  name: string;
  value: number;
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

/*
 * Aquí vivía `computeClientReport`, que alimentaba una tabla de resumen por
 * meses dentro de la app. Esa tabla ya no existe: coach, alumno y atleta ven la
 * misma matriz de progreso (`ProgressMatrix`), así que el único informe que
 * queda es el PDF, que se construye entero en `buildClientReportHtml`.
 */

/**
 * Informe de progreso con la identidad de UDECA (fondo oscuro, dorado):
 * entrenamientos, días y horas entrenadas, descanso medio entre sesiones,
 * mejores marcas de empuje/tirón (reps e isométricos), meses, peso y rutina.
 */
export function buildClientReportHtml(data: ClientReportData): string {
  const {
    client,
    routine,
    weightLogs,
    workoutLogs,
    muscleByExercise = {},
    measureByExercise = {},
  } = data;

  // ----- Métricas de cabecera -----
  const totalWorkouts = workoutLogs.length;
  const dayKeys = [...new Set(workoutLogs.map((l) => new Date(l.date).toDateString()))];
  const daysTrained = dayKeys.length;
  const totalMinutes = workoutLogs.reduce((s, l) => s + (l.durationMin ?? 0), 0);
  const hoursTrained =
    totalMinutes > 0 ? `${(totalMinutes / 60).toFixed(1).replace('.', ',')} h` : '—';
  // Descanso medio: media de días entre sesiones (días naturales) menos 1.
  const dayTimes = dayKeys.map((k) => new Date(k).getTime()).sort((a, b) => a - b);
  let avgRest = '—';
  if (dayTimes.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < dayTimes.length; i++) {
      gaps.push((dayTimes[i] - dayTimes[i - 1]) / (24 * 60 * 60 * 1000));
    }
    const rest = Math.max(0, gaps.reduce((s, g) => s + g, 0) / gaps.length - 1);
    avgRest = `${rest.toFixed(1).replace('.', ',')} días`;
  }

  const lastWeight = weightLogs[weightLogs.length - 1];
  const firstWeight = weightLogs[0];
  const weightChange =
    firstWeight && lastWeight ? (lastWeight.weightKg - firstWeight.weightKg).toFixed(1) : null;

  // ----- Mejores marcas empuje / tirón -----
  const push = bestMarks(workoutLogs, 'Empuje', muscleByExercise, measureByExercise);
  const pull = bestMarks(workoutLogs, 'Tirón', muscleByExercise, measureByExercise);
  const markRow = (label: string, m: Mark | null, unit: string) =>
    `<div class="mark"><span class="mark-label">${label}</span><span class="mark-value">${
      m ? `${m.value}${unit}` : '—'
    }</span><span class="mark-name">${m ? escapeHtml(m.name) : 'Sin registros'}</span></div>`;

  // ----- Meses -----
  const monthRows = workoutsByMonth(workoutLogs)
    .slice(0, 6)
    .map((m) => {
      const label = m.label.charAt(0).toUpperCase() + m.label.slice(1);
      return `<tr><td>${escapeHtml(label)}</td><td>${m.sessions.length}</td><td>${m.totalSets}</td><td>${m.totalReps}</td><td>${m.totalSeconds > 0 ? `${m.totalSeconds}s` : '—'}</td><td>${m.volumeKg > 0 ? `${m.volumeKg.toLocaleString('es-ES')} kg` : '—'}</td></tr>`;
    })
    .join('');

  const routineDays = routine
    ? routine.days
        .map(
          (d) =>
            `<tr><td>${escapeHtml(d.name)}</td><td>${d.isRest ? 'Descanso' : `${d.exercises.length} ejercicios · ${d.exercises.reduce((a, e) => a + (e.sets || 0), 0)} series`}</td></tr>`
        )
        .join('')
    : '';

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; background: #0C0D10; color: #ECEDEF; padding: 32px; margin: 0; }
          .brand { color: #C9902B; font-weight: 800; font-size: 12px; letter-spacing: 3px; text-transform: uppercase; }
          .rule { height: 2px; width: 56px; background: #C9902B; margin: 10px 0 18px; }
          h1 { font-size: 24px; margin: 6px 0 2px; color: #FFFFFF; }
          .muted { color: #9AA0A8; font-size: 12px; }
          h2 { font-size: 13px; margin: 26px 0 10px; color: #E3B15C; text-transform: uppercase; letter-spacing: 2px; }
          .tiles { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
          .tile { flex: 1; min-width: 120px; background: #16181D; border: 1px solid #2A2D34; border-radius: 12px; padding: 14px 16px; text-align: center; }
          .tile b { display: block; font-size: 24px; color: #E3B15C; margin-bottom: 2px; }
          .tile span { font-size: 10px; color: #9AA0A8; text-transform: uppercase; letter-spacing: 1px; }
          .cols { display: flex; gap: 10px; }
          .col { flex: 1; background: #16181D; border: 1px solid #2A2D34; border-radius: 12px; padding: 14px 16px; }
          .col h3 { margin: 0 0 10px; font-size: 12px; color: #FFFFFF; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 1px solid #2A2D34; padding-bottom: 8px; }
          .mark { display: flex; align-items: baseline; gap: 8px; padding: 5px 0; }
          .mark-label { font-size: 11px; color: #9AA0A8; width: 82px; }
          .mark-value { font-size: 16px; font-weight: 800; color: #E3B15C; }
          .mark-name { font-size: 11px; color: #C6CAD1; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; background: #16181D; border: 1px solid #2A2D34; border-radius: 12px; overflow: hidden; }
          th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #22252B; }
          th { color: #9AA0A8; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; background: #121418; }
          tr:last-child td { border-bottom: none; }
          .weight-line { font-size: 13px; color: #C6CAD1; }
          .weight-line b { color: #E3B15C; }
          .foot { margin-top: 30px; font-size: 10px; color: #6B7078; letter-spacing: 1px; text-transform: uppercase; text-align: center; }
        </style>
      </head>
      <body>
        <div class="brand">UDECA — Universidad de Calistenia</div>
        <div class="rule"></div>
        <h1>${escapeHtml(client.name)}</h1>
        <p class="muted">Informe de progreso · ${formatDate(Date.now())}${
          client.level ? ` · Nivel: ${escapeHtml(client.level)}` : ''
        }${client.goal ? ` · Objetivo: ${escapeHtml(client.goal)}` : ''}</p>

        <div class="tiles">
          <div class="tile"><b>${totalWorkouts}</b><span>Entrenamientos</span></div>
          <div class="tile"><b>${daysTrained}</b><span>Días entrenados</span></div>
          <div class="tile"><b>${hoursTrained}</b><span>Horas entrenadas</span></div>
          <div class="tile"><b>${avgRest}</b><span>Descanso medio</span></div>
        </div>

        <h2>Mejores marcas</h2>
        <div class="cols">
          <div class="col">
            <h3>Empuje</h3>
            ${markRow('Isométrico', push.secs, 's')}
            ${markRow('Repeticiones', push.reps, ' reps')}
          </div>
          <div class="col">
            <h3>Tirón</h3>
            ${markRow('Isométrico', pull.secs, 's')}
            ${markRow('Repeticiones', pull.reps, ' reps')}
          </div>
        </div>

        <h2>Entrenamiento por mes</h2>
        ${
          monthRows
            ? `<table><tr><th>Mes</th><th>Sesiones</th><th>Series</th><th>Reps</th><th>Isométrico</th><th>Volumen</th></tr>${monthRows}</table>`
            : '<p class="muted">Sin entrenamientos registrados.</p>'
        }

        ${
          lastWeight
            ? `<h2>Peso</h2><p class="weight-line">Actual: <b>${lastWeight.weightKg} kg</b>${
                weightChange !== null
                  ? ` · Cambio desde el inicio: <b>${Number(weightChange) >= 0 ? '+' : ''}${weightChange} kg</b>`
                  : ''
              }</p>`
            : ''
        }

        ${
          routine
            ? `<h2>Rutina actual · ${escapeHtml(routine.name)}</h2><table><tr><th>Día</th><th>Contenido</th></tr>${routineDays}</table>`
            : ''
        }

        <div class="foot">Generado por UDECA · www.udeca.app</div>
      </body>
    </html>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
