import { diaEnZona, inicioDelDia, inicioDelMes, marcaEnZona } from './fechas';

/*
 * LLAMADAS 1:1 CON EL ENTRENADOR.
 *
 * El alumno reserva una llamada en un hueco libre del entrenador, sin
 * mensajes de ida y vuelta para cuadrar la hora. CALICO solo pone el CUÁNDO y
 * el CUÁNTAS: la llamada en sí sigue por WhatsApp, por teléfono o por el
 * enlace que el entrenador use (Meet, Zoom…), que es donde ya habla con sus
 * alumnos.
 *
 * El entrenador decide:
 *  - Su disponibilidad: franjas por día de la semana ("lunes de 9 a 13") en
 *    SU hora, la duración de cada llamada y con cuánto margen se reserva.
 *  - Sus planes, por prioridad: cada uno con cuántas llamadas al mes incluye,
 *    con cuántos días de antelación se puede reservar (el plan más alto ve
 *    antes la agenda) y si incluye el contenido VIP de los cursos. A cada
 *    alumno le pone el suyo; sin plan, vale lo de "sin plan".
 *
 * Todo lo que decide aquí es puro —sin Firestore ni pantallas— para poder
 * probarlo entero (scripts/check-llamadas.mjs).
 */

export type ComoEsLaLlamada = 'whatsapp' | 'telefono' | 'enlace';

/** Una franja de un día de la semana: `dia` 0 = lunes … 6 = domingo. */
export interface Franja {
  dia: number;
  desde: string;
  hasta: string;
}

export interface PlanDelCoach {
  id: string;
  nombre: string;
  llamadasAlMes: number;
  /** Hasta cuántos días por delante puede reservar. */
  antelacionDias: number;
  /** Si incluye las clases VIP de los cursos. */
  vip: boolean;
}

export interface AjustesLlamadas {
  trainerId: string;
  activas: boolean;
  franjas: Franja[];
  duracionMin: number;
  /** Se reserva con al menos estas horas de margen. */
  margenHoras: number;
  /** El alumno puede cancelar hasta estas horas antes. */
  cancelarHastaHoras: number;
  como: ComoEsLaLlamada;
  /** El enlace de la llamada, si `como` es 'enlace'. */
  enlace?: string;
  /** La zona horaria del entrenador (IANA), en la que están las franjas. */
  zona?: string;
  /** Por prioridad: el primero es el más alto. */
  planes: PlanDelCoach[];
  /** Lo que tiene quien no tiene plan asignado. */
  sinPlan: { llamadasAlMes: number; antelacionDias: number };
  updatedAt?: number;
}

export interface Llamada {
  id: string;
  trainerId: string;
  clientId: string;
  inicio: number;
  fin: number;
  createdAt: number;
}

/**
 * Lo que hace un alumno con sus llamadas, para la bandeja "Por revisar" del
 * entrenador (lib/bandeja.ts). Hace falta aparte porque cancelar BORRA la
 * llamada: sin esto, de una cancelación no quedaría ni rastro.
 */
export interface ActividadDeLlamada {
  id: string;
  trainerId: string;
  clientId: string;
  tipo: 'reservada' | 'cancelada';
  /** Cuándo es (o era) la llamada. */
  inicio: number;
  /** Cuándo pasó: al reservar o al cancelar. */
  cuando: number;
}

export const DURACIONES = [15, 20, 30, 45, 60] as const;
export const MARGENES_HORAS = [1, 3, 12, 24, 48] as const;
export const MAX_ANTELACION_DIAS = 60;
export const NOMBRE_DEL_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const INICIAL_DEL_DIA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export const AJUSTES_POR_DEFECTO: Omit<AjustesLlamadas, 'trainerId'> = {
  activas: false,
  franjas: [],
  duracionMin: 30,
  margenHoras: 12,
  cancelarHastaHoras: 12,
  como: 'whatsapp',
  planes: [],
  sinPlan: { llamadasAlMes: 0, antelacionDias: 14 },
};

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

/** "9:00" o "09:00" → 540. null si no es una hora. */
export function minutosDe(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 24 || mi > 59 || (h === 24 && mi > 0)) return null;
  return h * 60 + mi;
}

/** 540 → "09:00". */
export function hhmm(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

/** Lo escrito a mano, como hora: "9" → "09:00", "930" → "09:30", "9.30" → "09:30". */
export function normalizarHora(escrito: string): string | null {
  const t = escrito.trim().replace(/[.h]/g, ':');
  const conDos = /^\d{1,2}$/.test(t) ? `${t}:00` : /^\d{3,4}$/.test(t) ? `${t.slice(0, -2)}:${t.slice(-2)}` : t;
  const min = minutosDe(conDos);
  return min === null ? null : hhmm(min);
}

/** ¿Es una franja que se pueda usar? (Empieza antes de acabar y cabe una llamada.) */
export function franjaValida(f: Franja, duracionMin: number): boolean {
  const a = minutosDe(f.desde);
  const b = minutosDe(f.hasta);
  return a !== null && b !== null && f.dia >= 0 && f.dia <= 6 && b - a >= duracionMin;
}

export function idDeLlamada(trainerId: string, inicio: number): string {
  return `${trainerId}_${inicio}`;
}

/** Lo que tiene un alumno según su plan (o lo de "sin plan"). */
export function loQueTiene(
  ajustes: Pick<AjustesLlamadas, 'planes' | 'sinPlan'>,
  planId?: string | null
): { plan: PlanDelCoach | null; llamadasAlMes: number; antelacionDias: number } {
  const plan = planId ? ajustes.planes.find((p) => p.id === planId) ?? null : null;
  return plan
    ? { plan, llamadasAlMes: plan.llamadasAlMes, antelacionDias: plan.antelacionDias }
    : { plan: null, ...ajustes.sinPlan };
}

/** La prioridad de un plan: 0 el más alto. Sin plan, detrás de todos. */
export function prioridadDe(ajustes: Pick<AjustesLlamadas, 'planes'>, planId?: string | null): number {
  const i = planId ? ajustes.planes.findIndex((p) => p.id === planId) : -1;
  return i >= 0 ? i : ajustes.planes.length;
}

/** Las llamadas que caen en el mismo mes natural que `ts`. */
export function delMes(llamadas: Pick<Llamada, 'inicio'>[], ts: number): number {
  const mes = inicioDelMes(ts);
  return llamadas.filter((l) => inicioDelMes(l.inicio) === mes).length;
}

/** Las que aún no han terminado, de la más próxima a la más lejana. */
export function proximas<T extends Pick<Llamada, 'inicio' | 'fin'>>(llamadas: T[], ahora = Date.now()): T[] {
  return llamadas.filter((l) => l.fin > ahora).sort((a, b) => a.inicio - b.inicio);
}

export interface DiaConHuecos {
  /** Las 00:00 del día, en la hora de quien mira. */
  dia: number;
  /** El inicio de cada hueco libre. */
  huecos: number[];
}

/**
 * LOS HUECOS LIBRES, día a día, desde ahora hasta `antelacionDias` por delante.
 *
 * Cada franja se parte en llamadas de `duracionMin`. Se quita lo que choca con
 * una llamada ya reservada (de cualquier alumno) y lo que no respeta el margen
 * mínimo para reservar. Las horas se calculan en la zona del entrenador y se
 * devuelven como instantes: cada uno las ve en la suya.
 */
export function huecosLibres(
  ajustes: Pick<AjustesLlamadas, 'franjas' | 'duracionMin' | 'margenHoras' | 'zona'>,
  antelacionDias: number,
  ocupadas: Pick<Llamada, 'inicio' | 'fin'>[],
  ahora = Date.now()
): DiaConHuecos[] {
  const dur = ajustes.duracionMin;
  if (!dur || antelacionDias <= 0) return [];
  const desde = ahora + ajustes.margenHoras * HORA;
  const hasta = ahora + Math.min(antelacionDias, MAX_ANTELACION_DIAS) * DIA;
  const choca = (a: number, b: number) => ocupadas.some((o) => a < o.fin && b > o.inicio);
  const hoy = diaEnZona(ahora, ajustes.zona);
  const porDia = new Map<number, Set<number>>();
  for (let i = 0; i <= Math.min(antelacionDias, MAX_ANTELACION_DIAS); i++) {
    // El día i del calendario del entrenador (Date.UTC solo para contar días).
    const f = new Date(Date.UTC(hoy.y, hoy.m, hoy.d + i));
    const y = f.getUTCFullYear();
    const m = f.getUTCMonth();
    const d = f.getUTCDate();
    const diaSemana = (f.getUTCDay() + 6) % 7;
    for (const franja of ajustes.franjas) {
      if (franja.dia !== diaSemana) continue;
      const a = minutosDe(franja.desde);
      const b = minutosDe(franja.hasta);
      if (a === null || b === null) continue;
      for (let mi = a; mi + dur <= b; mi += dur) {
        const ts = marcaEnZona(ajustes.zona, y, m, d, mi);
        if (ts < desde || ts > hasta || choca(ts, ts + dur * 60000)) continue;
        const k = inicioDelDia(ts);
        porDia.set(k, (porDia.get(k) ?? new Set()).add(ts));
      }
    }
  }
  return [...porDia.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dia, s]) => ({ dia, huecos: [...s].sort((a, b) => a - b) }));
}

export type PorQueNo = 'apagadas' | 'sin-llamadas' | 'sin-cupo' | 'ocupada' | 'fuera-de-plazo';

/**
 * ¿Puede este alumno reservar a esta hora? Lo comprueba todo junto: que las
 * llamadas estén encendidas, que su plan las incluya, que le quede cupo en el
 * mes de ESA llamada (reservar para el mes que viene gasta el del mes que
 * viene) y que el hueco siga libre y dentro de plazo.
 */
export function puedeReservar(p: {
  ajustes: AjustesLlamadas;
  planId?: string | null;
  mias: Pick<Llamada, 'inicio'>[];
  ocupadas: Pick<Llamada, 'inicio' | 'fin'>[];
  inicio: number;
  ahora?: number;
}): { ok: true } | { ok: false; porque: PorQueNo } {
  const ahora = p.ahora ?? Date.now();
  if (!p.ajustes.activas) return { ok: false, porque: 'apagadas' };
  const suyo = loQueTiene(p.ajustes, p.planId);
  if (suyo.llamadasAlMes <= 0) return { ok: false, porque: 'sin-llamadas' };
  if (delMes(p.mias, p.inicio) >= suyo.llamadasAlMes) return { ok: false, porque: 'sin-cupo' };
  const libres = huecosLibres(p.ajustes, suyo.antelacionDias, p.ocupadas, ahora);
  if (libres.some((d) => d.huecos.includes(p.inicio))) return { ok: true };
  const fin = p.inicio + p.ajustes.duracionMin * 60000;
  return p.ocupadas.some((o) => p.inicio < o.fin && fin > o.inicio)
    ? { ok: false, porque: 'ocupada' }
    : { ok: false, porque: 'fuera-de-plazo' };
}

/** ¿Puede el alumno cancelarla todavía? (El entrenador, siempre.) */
export function puedeCancelar(
  llamada: Pick<Llamada, 'inicio'>,
  ajustes: Pick<AjustesLlamadas, 'cancelarHastaHoras'>,
  ahora = Date.now()
): boolean {
  return llamada.inicio - ahora >= ajustes.cancelarHastaHoras * HORA;
}

/** Lo que se le dice al alumno cuando no puede reservar. */
export const TEXTO_POR_QUE_NO: Record<PorQueNo, string> = {
  apagadas: 'Tu entrenador no tiene las llamadas abiertas ahora mismo.',
  'sin-llamadas': 'Tu plan no incluye llamadas. Pregúntale a tu entrenador.',
  'sin-cupo': 'Ya has reservado todas las llamadas de ese mes.',
  ocupada: 'Esa hora acaba de cogerse. Elige otra.',
  'fuera-de-plazo': 'Esa hora ya no se puede reservar. Elige otra.',
};

/** Un id corto para un plan nuevo. */
export function nuevoIdDePlan(azar: () => number = Math.random): string {
  return `plan-${Math.floor(azar() * 36 ** 6).toString(36).padStart(6, '0')}`;
}

/** Cómo es la llamada, dicho al alumno. */
export const COMO_SE_HACE: Record<ComoEsLaLlamada, string> = {
  whatsapp: 'Tu entrenador te llamará por WhatsApp',
  telefono: 'Tu entrenador te llamará por teléfono',
  enlace: 'Por videollamada: entra con el enlace a la hora',
};
