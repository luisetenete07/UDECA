import type {
  BodyMeasurement,
  LoggedExercise,
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

export interface ClientReportData {
  client: UserProfile;
  routine: Routine | null;
  weightLogs: WeightLog[];
  workoutLogs: WorkoutLog[];
  measurements: BodyMeasurement[];
  nutritionPlan: NutritionPlan | null;
}

/** Genera el HTML de un informe de progreso de cliente, listo para exportar a PDF. */
export function buildClientReportHtml(data: ClientReportData): string {
  const { client, routine, weightLogs, workoutLogs, measurements, nutritionPlan } = data;

  const firstWeight = weightLogs[0];
  const lastWeight = weightLogs[weightLogs.length - 1];
  const weightChange =
    firstWeight && lastWeight ? (lastWeight.weightKg - firstWeight.weightKg).toFixed(1) : null;

  const routineRows = routine
    ? routine.days
        .map(
          (day) => `
        <h4>${escapeHtml(day.name)}</h4>
        <table>
          <tr><th>Ejercicio</th><th>Series</th><th>Reps</th></tr>
          ${day.exercises
            .map(
              (ex) =>
                `<tr><td>${escapeHtml(ex.name)}</td><td>${ex.sets}</td><td>${escapeHtml(ex.reps)}</td></tr>`
            )
            .join('')}
        </table>`
        )
        .join('')
    : '<p class="muted">Sin rutina activa.</p>';

  const workoutRows = workoutLogs
    .slice(0, 12)
    .map(
      (log) =>
        `<tr><td>${formatDate(log.date)}</td><td>${escapeHtml(log.dayName)}</td><td>${log.exercises.length}</td></tr>`
    )
    .join('');

  const weightRows = weightLogs
    .slice()
    .reverse()
    .slice(0, 12)
    .map((log) => `<tr><td>${formatDate(log.date)}</td><td>${log.weightKg} kg</td></tr>`)
    .join('');

  const lastMeasurement = measurements[measurements.length - 1];

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #0B1220; padding: 24px; }
          h1 { font-size: 22px; margin-bottom: 4px; }
          h2 { font-size: 16px; margin-top: 28px; border-bottom: 2px solid #22D3EE; padding-bottom: 4px; }
          h4 { font-size: 14px; margin-bottom: 4px; }
          .muted { color: #64748B; font-size: 13px; }
          .stats { display: flex; gap: 16px; margin: 12px 0; }
          .stat { border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 16px; }
          .stat b { display: block; font-size: 18px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 13px; }
          th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #E2E8F0; }
          th { color: #64748B; font-weight: 600; }
        </style>
      </head>
      <body>
        <h1>Informe de progreso — ${escapeHtml(client.name)}</h1>
        <p class="muted">Generado el ${formatDate(Date.now())}</p>

        <div class="stats">
          <div class="stat"><b>${lastWeight ? `${lastWeight.weightKg} kg` : '—'}</b>Peso actual</div>
          <div class="stat"><b>${weightChange !== null ? `${Number(weightChange) >= 0 ? '+' : ''}${weightChange} kg` : '—'}</b>Cambio de peso</div>
          <div class="stat"><b>${workoutLogs.length}</b>Entrenos registrados</div>
        </div>

        <h2>Rutina actual</h2>
        ${routineRows}

        <h2>Plan nutricional</h2>
        ${
          nutritionPlan
            ? `<p>${escapeHtml(nutritionPlan.name)} — ${nutritionPlan.dailyCalories} kcal/día (P${nutritionPlan.proteinG}g · C${nutritionPlan.carbsG}g · G${nutritionPlan.fatG}g)</p>`
            : '<p class="muted">Sin plan nutricional activo.</p>'
        }

        <h2>Últimas medidas corporales</h2>
        ${
          lastMeasurement
            ? `<p>${formatDate(lastMeasurement.date)} — ${[
                lastMeasurement.chestCm ? `Pecho ${lastMeasurement.chestCm}cm` : null,
                lastMeasurement.waistCm ? `Cintura ${lastMeasurement.waistCm}cm` : null,
                lastMeasurement.hipsCm ? `Cadera ${lastMeasurement.hipsCm}cm` : null,
                lastMeasurement.armCm ? `Brazo ${lastMeasurement.armCm}cm` : null,
                lastMeasurement.thighCm ? `Muslo ${lastMeasurement.thighCm}cm` : null,
              ]
                .filter(Boolean)
                .join(' · ')}</p>`
            : '<p class="muted">Sin medidas registradas.</p>'
        }

        <h2>Historial de peso</h2>
        ${
          weightRows
            ? `<table><tr><th>Fecha</th><th>Peso</th></tr>${weightRows}</table>`
            : '<p class="muted">Sin registros de peso.</p>'
        }

        <h2>Últimos entrenamientos</h2>
        ${
          workoutRows
            ? `<table><tr><th>Fecha</th><th>Sesión</th><th>Ejercicios</th></tr>${workoutRows}</table>`
            : '<p class="muted">Sin entrenamientos registrados.</p>'
        }
      </body>
    </html>
  `;
}

export interface SessionResultData {
  clientName: string;
  routineName: string;
  dayName: string;
  date: number;
  durationMin: number;
  sets: number;
  reps: number;
  seconds?: number;
  volumeKg: number;
  exercises: LoggedExercise[];
  prs?: { exerciseName: string; label: string }[];
  streak?: number;
}

/**
 * HTML del resumen de UNA sesión de entrenamiento, para descargar/guardar como
 * PDF y poder volver a consultarlo cuando se quiera.
 */
export function buildSessionResultHtml(data: SessionResultData): string {
  const stats = [
    data.durationMin > 0 ? `<div class="stat"><b>${data.durationMin} min</b>Duración</div>` : '',
    `<div class="stat"><b>${data.sets}</b>Series</div>`,
    data.reps > 0 ? `<div class="stat"><b>${data.reps}</b>Reps</div>` : '',
    data.seconds && data.seconds > 0
      ? `<div class="stat"><b>${data.seconds}s</b>Isométrico</div>`
      : '',
    data.volumeKg > 0
      ? `<div class="stat"><b>${data.volumeKg.toLocaleString('es-ES')} kg</b>Volumen</div>`
      : '',
  ]
    .filter(Boolean)
    .join('');

  const exerciseBlocks = data.exercises
    .map((ex) => {
      const unit = ex.measure === 'seconds' ? 's' : 'reps';
      const rows = ex.sets
        .map((s, i) => {
          const done = s.completed ? '✅' : '⬜';
          const weight = s.weight ? ` · ${escapeHtml(s.weight)} kg` : '';
          const val = s.reps ? `${escapeHtml(s.reps)} ${unit}` : '—';
          return `<tr><td>${done} Serie ${i + 1}</td><td>${val}${weight}</td></tr>`;
        })
        .join('');
      return `<h4>${escapeHtml(ex.name)}</h4><table>${rows}</table>`;
    })
    .join('');

  const prBlock =
    data.prs && data.prs.length > 0
      ? `<h2>Récords personales 🏆</h2>${data.prs
          .map(
            (pr) =>
              `<p><b>${escapeHtml(pr.exerciseName)}</b> — ${escapeHtml(pr.label)}</p>`
          )
          .join('')}`
      : '';

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #0B1220; padding: 24px; }
          h1 { font-size: 22px; margin-bottom: 4px; }
          h2 { font-size: 16px; margin-top: 28px; border-bottom: 2px solid #C9902B; padding-bottom: 4px; }
          h4 { font-size: 14px; margin: 16px 0 4px; }
          .muted { color: #64748B; font-size: 13px; }
          .stats { display: flex; flex-wrap: wrap; gap: 12px; margin: 16px 0; }
          .stat { border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 16px; }
          .stat b { display: block; font-size: 18px; color: #B4791E; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 13px; }
          td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #E2E8F0; }
          td:last-child { text-align: right; font-weight: 600; }
        </style>
      </head>
      <body>
        <h1>Entrenamiento completado 💪</h1>
        <p class="muted">${escapeHtml(data.clientName)} · ${escapeHtml(data.routineName)} — ${escapeHtml(
          data.dayName
        )}</p>
        <p class="muted">${formatDate(data.date)}${
          data.streak && data.streak > 1 ? ` · Racha de ${data.streak} días 🔥` : ''
        }</p>

        <div class="stats">${stats}</div>

        ${prBlock}

        <h2>Detalle por ejercicio</h2>
        ${exerciseBlocks || '<p class="muted">Sesión marcada como completada.</p>'}

        <p class="muted" style="margin-top:28px">Generado por UDECA — Universidad de Calistenia</p>
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
