import { inicioDeLaSemana } from './fechas';
import type { PlannedCycle } from './cyclePlan';
import type { TrainingCycle, WeekPlanEntry } from './types';

/**
 * Plantillas de plan: guardar una temporada entera —bloques, semanas,
 * descargas y la programación de cada semana— y volver a montarla en otro
 * alumno con un toque.
 *
 * Es el mismo argumento que hizo falta para crear el plan, un nivel más
 * arriba. Montar doce semanas dejó de ser dieciséis formularios, pero con cinco
 * alumnos vuelven a ser sesenta hojas de programación. Un entrenador que
 * trabaja con el mismo método en varias personas no puede escribirlo cinco
 * veces: lo escribe una y lo aplica.
 *
 * Lo que se guarda son NÚMEROS y NOMBRES, nunca fechas: una plantilla no tiene
 * calendario. Las fechas se calculan al aplicarla, a partir del lunes que elija
 * el entrenador.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export interface TemplateWeek {
  name: string;
  isDeload?: boolean;
  targetSessions?: number;
  weekPlan?: WeekPlanEntry[];
}

export interface TemplateBlock {
  name: string;
  goal?: string;
  weeks: TemplateWeek[];
}

export interface PlanTemplate {
  id: string;
  trainerId: string;
  name: string;
  goal?: string;
  blocks: TemplateBlock[];
  createdAt: number;
}

/** Semanas que ocupa la plantilla. */
export function templateWeeks(t: Pick<PlanTemplate, 'blocks'>): number {
  return t.blocks.reduce((n, b) => n + b.weeks.length, 0);
}

/** Entrenos previstos en toda la plantilla (para el resumen antes de aplicar). */
export function templateSessions(t: Pick<PlanTemplate, 'blocks'>): number {
  return t.blocks.reduce(
    (n, b) => n + b.weeks.reduce((m, w) => m + (w.targetSessions ?? 0), 0),
    0
  );
}

/**
 * Convierte un plan existente en plantilla.
 *
 * Se queda con la ESTRUCTURA y los números; las fechas se tiran a propósito.
 * Un plan de septiembre aplicado en enero con sus fechas de septiembre no sería
 * un plan, sería un archivo.
 */
export function templateFromCycles(
  root: TrainingCycle,
  all: TrainingCycle[],
  name: string
): Omit<PlanTemplate, 'id' | 'trainerId' | 'createdAt'> {
  const porOrden = (a: TrainingCycle, b: TrainingCycle) =>
    (a.orderIndex ?? 0) - (b.orderIndex ?? 0) ||
    (a.startDate ?? a.createdAt) - (b.startDate ?? b.createdAt);

  const bloques = all.filter((c) => c.parentId === root.id).sort(porOrden);

  return {
    name: name.trim() || root.name,
    goal: root.goal,
    blocks: bloques.map((b) => ({
      name: b.name,
      goal: b.goal,
      weeks: all
        .filter((c) => c.parentId === b.id)
        .sort(porOrden)
        .map((w) => ({
          name: w.name,
          isDeload: w.isDeload,
          targetSessions: w.targetSessions,
          weekPlan: (w.weekPlan ?? []).length > 0 ? w.weekPlan : undefined,
        })),
    })),
  };
}

/**
 * Monta los ciclos de la plantilla a partir de una fecha.
 *
 * Devuelve lo mismo que `buildPlan`, así que lo guarda el mismo código: un solo
 * lote, o entra todo o no entra nada.
 */
export function cyclesFromTemplate(
  template: Pick<PlanTemplate, 'name' | 'goal' | 'blocks'>,
  startDate: number
): PlannedCycle[] {
  const inicio = inicioDeLaSemana(startDate);
  const semanas = templateWeeks(template);
  const out: PlannedCycle[] = [];

  out.push({
    key: 'macro',
    level: 'macro',
    name: template.name,
    startDate: inicio,
    endDate: inicio + semanas * WEEK_MS - DAY_MS,
    orderIndex: 1,
    goal: template.goal,
    targetSessions: templateSessions(template) || undefined,
  });

  let cursor = inicio;
  template.blocks.forEach((bloque, bi) => {
    const mesoKey = `meso-${bi}`;
    const largo = Math.max(1, bloque.weeks.length);
    out.push({
      key: mesoKey,
      parentKey: 'macro',
      level: 'meso',
      name: bloque.name,
      startDate: cursor,
      endDate: cursor + largo * WEEK_MS - DAY_MS,
      orderIndex: bi + 1,
      goal: bloque.goal,
      targetSessions:
        bloque.weeks.reduce((n, w) => n + (w.targetSessions ?? 0), 0) || undefined,
    });

    bloque.weeks.forEach((semana, wi) => {
      const desde = cursor + wi * WEEK_MS;
      out.push({
        key: `${mesoKey}-w${wi}`,
        parentKey: mesoKey,
        level: 'micro',
        name: semana.name,
        startDate: desde,
        endDate: desde + 6 * DAY_MS,
        orderIndex: wi + 1,
        isDeload: semana.isDeload,
        targetSessions: semana.targetSessions,
        weekPlan: semana.weekPlan,
      });
    });

    cursor += largo * WEEK_MS;
  });

  return out;
}

/**
 * Sugerencia de progresión para la semana siguiente: una repetición más donde
 * el objetivo es un número exacto.
 *
 * Es una SUGERENCIA que se pinta en la hoja para que el entrenador la corrija,
 * no una regla que se aplique sola. Un rango ("8-12") o un texto ("AMRAP") no
 * se tocan: ahí el número no significa lo que parece.
 */
export function suggestProgression(entries: WeekPlanEntry[]): WeekPlanEntry[] {
  return entries.map((e) => {
    const objetivo = (e.reps ?? '').trim();
    if (!/^\d+$/.test(objetivo)) return e;
    return { ...e, reps: String(Number(objetivo) + 1) };
  });
}
