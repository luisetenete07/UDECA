import { startOfWeek } from './stats';
import { PAYMENT_STATUS_LABEL, type UserProfile, type WeeklyCheckIn, type WorkoutLog } from './types';

/**
 * Copiloto del coach: análisis semanal determinista del grupo. Cruza
 * entrenamientos, check-ins y pagos para responder a "¿quién necesita
 * atención esta semana y por qué?" sin que el coach tenga que revisar
 * ficha por ficha. (Cuando haya backend, un LLM podrá redactar sobre esto.)
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const INACTIVE_DAYS = 7;
const LOW_SCORE = 2.5;

export interface CopilotAttention {
  uid: string;
  name: string;
  reasons: string[];
}

export interface CopilotReport {
  /** Alumnos que necesitan atención, ordenados por nº de motivos. */
  attention: CopilotAttention[];
  /** Señales positivas para reconocer o celebrar. */
  highlights: string[];
  /** Check-ins recibidos esta semana / alumnos activos. */
  checkinsThisWeek: number;
  totalClients: number;
}

export function buildCopilotReport(
  clients: UserProfile[],
  logs: WorkoutLog[],
  checkIns: WeeklyCheckIn[]
): CopilotReport {
  const now = Date.now();
  const week = startOfWeek(now);

  const lastLogByClient = new Map<string, number>();
  const weekSessionsByClient = new Map<string, number>();
  for (const log of logs) {
    const prev = lastLogByClient.get(log.clientId);
    if (!prev || log.date > prev) lastLogByClient.set(log.clientId, log.date);
    if (startOfWeek(log.date) === week) {
      weekSessionsByClient.set(log.clientId, (weekSessionsByClient.get(log.clientId) ?? 0) + 1);
    }
  }
  const weekCheckinByClient = new Map<string, WeeklyCheckIn>();
  for (const c of checkIns) {
    if (c.weekStart === week && !weekCheckinByClient.has(c.clientId)) {
      weekCheckinByClient.set(c.clientId, c);
    }
  }

  const attention: CopilotAttention[] = [];
  for (const client of clients) {
    if (client.status === 'inactive') continue; // dado de baja: no molestar
    const reasons: string[] = [];

    // Inactividad de entrenamiento.
    const last = lastLogByClient.get(client.uid);
    if (!last) reasons.push('Sin entrenamientos aún');
    else {
      const days = Math.floor((now - last) / DAY_MS);
      if (days > INACTIVE_DAYS) reasons.push(`Sin entrenar ${days} días`);
    }

    // Check-in de esta semana: bajo o ausente.
    const ci = weekCheckinByClient.get(client.uid);
    if (ci) {
      const avg = (ci.energy + ci.sleep + ci.adherence + ci.soreness) / 4;
      if (avg < LOW_SCORE) reasons.push(`Check-in bajo (${avg.toFixed(1).replace('.', ',')}/5)`);
      else if (ci.soreness <= 2) reasons.push('Sensaciones físicas muy bajas');
      if (ci.sleep <= 2) reasons.push('Duerme mal');
    } else {
      reasons.push('Sin check-in esta semana');
    }

    // Pagos.
    if (client.paymentStatus === 'overdue') reasons.push(PAYMENT_STATUS_LABEL.overdue);

    if (reasons.length > 0) attention.push({ uid: client.uid, name: client.name, reasons });
  }
  attention.sort((a, b) => b.reasons.length - a.reasons.length);

  // ----- Señales positivas -----
  const highlights: string[] = [];
  let topName = '';
  let topSessions = 0;
  for (const [uid, n] of weekSessionsByClient) {
    if (n > topSessions) {
      topSessions = n;
      topName = clients.find((c) => c.uid === uid)?.name.split(' ')[0] ?? '';
    }
  }
  if (topSessions >= 2 && topName) {
    highlights.push(`${topName} lidera la semana con ${topSessions} sesiones 🔥`);
  }
  for (const [clientId, ci] of weekCheckinByClient) {
    const avg = (ci.energy + ci.sleep + ci.adherence + ci.soreness) / 4;
    if (avg >= 4.5) {
      const name = clients.find((c) => c.uid === clientId)?.name.split(' ')[0];
      if (name) highlights.push(`${name} está en su mejor momento (check-in ${avg.toFixed(1).replace('.', ',')}/5)`);
      break; // uno basta: es un titular, no una lista
    }
  }

  return {
    attention,
    highlights,
    checkinsThisWeek: weekCheckinByClient.size,
    totalClients: clients.length,
  };
}
