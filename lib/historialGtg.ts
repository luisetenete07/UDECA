import { inicioDelDia, masDias } from './fechas';
import { objetivoDelDia, seriesDeHoy } from './gtg';
import { progresoDiario } from './rutinaDiaria';
import type { DiaDeRutinaDiaria, Routine, RutinaDiaria, WorkoutLog } from './types';

/**
 * LAS SERIES DEL GREASE THE GROOVE, DÍA A DÍA.
 *
 * Lo que se quiere ver es sencillo y es lo mismo para el alumno y para su
 * entrenador: cuántas series cayeron cada día de las últimas dos semanas y si
 * se llegó a lo que se buscaba. Sin tablas: una barra por día.
 *
 * Hay dos grease the groove en la app y los dos se cuentan igual:
 *  - el día "Grease the groove" del plan, que se apunta serie a serie en UN
 *    entreno por día (lib/gtg.ts);
 *  - la rutina diaria, que se marca casilla a casilla (lib/rutinaDiaria.ts).
 */
export interface DiaDeSeries {
  /** Las 00:00 del día. */
  dia: number;
  hechas: number;
  /** Lo que se buscaba ese día (0: ese día no tocaba o no se sabe). */
  objetivo: number;
}

/** ¿Es este entreno un día de grease the groove? */
export function esEntrenoGtg(log: WorkoutLog, routine?: Routine | null): boolean {
  if (log.gtg) return true;
  // Los de antes de guardar la marca: por la rutina y el nombre del día.
  if (!routine || log.routineId !== routine.id) return false;
  if (routine.schedule === 'gtg') return true;
  return routine.days.some((d) => d.gtg && (d.name || 'Grease the groove') === log.dayName);
}

/** Los últimos `cuantos` días, del más antiguo a hoy. */
function ultimosDias(cuantos: number, ahora: number): number[] {
  const hoy = inicioDelDia(ahora);
  return Array.from({ length: cuantos }, (_, i) => masDias(hoy, i - (cuantos - 1)));
}

/** El día GTG del plan: series por día, sacadas de sus entrenos. */
export function seriesGtgPorDia(
  logs: WorkoutLog[],
  routine: Routine | null | undefined,
  cuantos = 14,
  ahora = Date.now()
): DiaDeSeries[] {
  const delGtg = logs.filter((l) => esEntrenoGtg(l, routine));
  return ultimosDias(cuantos, ahora).map((dia) => {
    const deEseDia = delGtg.filter((l) => inicioDelDia(l.date) === dia);
    const hechas = deEseDia.reduce((n, l) => n + seriesDeHoy(l), 0);
    const guardado = deEseDia.find((l) => l.gtg?.objetivo)?.gtg?.objetivo;
    const delPlan = routine?.days.find((d) => d.gtg && deEseDia.some((l) => l.dayName === (d.name || 'Grease the groove')));
    const objetivo = guardado ?? (deEseDia.length > 0 ? objetivoDelDia(routine, delPlan ?? null) : 0);
    return { dia, hechas, objetivo };
  });
}

/** La rutina diaria: lo marcado cada día frente a lo que había que hacer. */
export function seriesDiariasPorDia(
  dias: DiaDeRutinaDiaria[],
  rutina: RutinaDiaria | null | undefined,
  cuantos = 14,
  ahora = Date.now()
): DiaDeSeries[] {
  return ultimosDias(cuantos, ahora).map((dia) => {
    const doc = dias.find((d) => inicioDelDia(d.date) === dia);
    if (!doc) return { dia, hechas: 0, objetivo: dia === inicioDelDia(ahora) ? progresoDiario(rutina, null, ahora).total : 0 };
    // Con lo que había que hacer ESE día si se guardó; si no (días de antes),
    // contado con la rutina de ahora.
    if (typeof doc.total === 'number') {
      return { dia, hechas: Math.min(doc.hechos?.length ?? 0, doc.total), objetivo: doc.total };
    }
    const p = progresoDiario(rutina, doc, doc.date);
    return { dia, hechas: p.hechos, objetivo: p.total };
  });
}

export interface ResumenDeSeries {
  /** Series de los últimos 7 días. */
  semana: number;
  /** Días con alguna serie, de los últimos 7. */
  dias: number;
  /** Días en que se llegó a lo que se buscaba, de los últimos 7. */
  cumplidos: number;
  /** Media de series en los días que se hizo algo (una decimal). */
  media: number;
  /** Series en total en todo el periodo. */
  total: number;
}

export function resumenDeSeries(dias: DiaDeSeries[]): ResumenDeSeries {
  const ultimos7 = dias.slice(-7);
  const conAlgo = ultimos7.filter((d) => d.hechas > 0);
  const semana = conAlgo.reduce((n, d) => n + d.hechas, 0);
  return {
    semana,
    dias: conAlgo.length,
    cumplidos: ultimos7.filter((d) => d.objetivo > 0 && d.hechas >= d.objetivo).length,
    media: conAlgo.length > 0 ? Math.round((semana / conAlgo.length) * 10) / 10 : 0,
    total: dias.reduce((n, d) => n + d.hechas, 0),
  };
}
