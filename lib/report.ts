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

export interface ClientReportData {
  client: UserProfile;
  routine: Routine | null;
  weightLogs: WeightLog[];
  workoutLogs: WorkoutLog[];
  nutritionPlan: NutritionPlan | null;
}

/** Genera el HTML de un informe de progreso de cliente, listo para exportar a PDF. */
export function buildClientReportHtml(data: ClientReportData): string {
  const { client, routine, weightLogs, workoutLogs, nutritionPlan } = data;

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

  // Registro de entrenamiento por mes (últimos 6 meses con actividad).
  const monthRows = workoutsByMonth(workoutLogs)
    .slice(0, 6)
    .map((m) => {
      const label = m.label.charAt(0).toUpperCase() + m.label.slice(1);
      return `<tr><td>${escapeHtml(label)}</td><td>${m.sessions.length}</td><td>${m.totalSets}</td><td>${m.totalReps}</td><td>${m.totalSeconds > 0 ? `${m.totalSeconds}s` : '—'}</td><td>${m.volumeKg > 0 ? `${m.volumeKg.toLocaleString('es-ES')} kg` : '—'}</td></tr>`;
    })
    .join('');

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #0B1220; padding: 24px; }
          h1 { font-size: 22px; margin-bottom: 4px; }
          .brand { color: #B4791E; font-weight: 700; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px; }
          h2 { font-size: 16px; margin-top: 28px; border-bottom: 2px solid #C9902B; padding-bottom: 4px; }
          h4 { font-size: 14px; margin-bottom: 4px; }
          .muted { color: #64748B; font-size: 13px; }
          .stats { display: flex; flex-wrap: wrap; gap: 16px; margin: 12px 0; }
          .stat { border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px 16px; }
          .stat b { display: block; font-size: 18px; color: #B4791E; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 13px; }
          th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #E2E8F0; }
          th { color: #64748B; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="brand">UDECA — Universidad de Calistenia</div>
        <h1>Informe de progreso — ${escapeHtml(client.name)}</h1>
        <p class="muted">Generado el ${formatDate(Date.now())}</p>

        <div class="stats">
          <div class="stat"><b>${lastWeight ? `${lastWeight.weightKg} kg` : '—'}</b>Peso actual</div>
          <div class="stat"><b>${weightChange !== null ? `${Number(weightChange) >= 0 ? '+' : ''}${weightChange} kg` : '—'}</b>Cambio de peso</div>
          <div class="stat"><b>${workoutLogs.length}</b>Entrenos registrados</div>
        </div>

        <h2>Entrenamiento por mes</h2>
        ${
          monthRows
            ? `<table><tr><th>Mes</th><th>Sesiones</th><th>Series</th><th>Reps</th><th>Isométrico</th><th>Volumen</th></tr>${monthRows}</table>`
            : '<p class="muted">Sin entrenamientos registrados.</p>'
        }

        <h2>Rutina actual</h2>
        ${routineRows}

        <h2>Plan nutricional</h2>
        ${
          nutritionPlan
            ? `<p>${escapeHtml(nutritionPlan.name)} — ${nutritionPlan.dailyCalories} kcal/día (P${nutritionPlan.proteinG}g · C${nutritionPlan.carbsG}g · G${nutritionPlan.fatG}g)</p>`
            : '<p class="muted">Sin plan nutricional activo.</p>'
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
