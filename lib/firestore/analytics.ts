import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import type { FunnelEvent } from '../analytics';

/** Contadores de un día: `{ intro_start: 12, register_view: 7, ... }`. */
export type DailyCounters = Partial<Record<FunnelEvent, number>> & {
  id: string;
  updatedAt?: number;
};

/** Días hacia atrás que se leen. 60 documentos es una lectura barata. */
const MAX_DAYS = 60;

export async function getDailyCounters(): Promise<DailyCounters[]> {
  // El id del documento ES la fecha (AAAA-MM-DD), así que ordenar por nombre
  // ordena por fecha sin necesidad de índice ni de campo extra.
  const snap = await getDocs(
    query(collection(db, 'analytics'), orderBy('__name__', 'desc'), limit(MAX_DAYS))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DailyCounters);
}

/** Suma los contadores de los últimos `days` días. */
export function sumCounters(rows: DailyCounters[], days: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows.slice(0, days)) {
    for (const [k, v] of Object.entries(row)) {
      if (typeof v === 'number' && k !== 'updatedAt') out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

export interface FunnelStep {
  key: FunnelEvent;
  label: string;
  value: number;
  /** % respecto al primer paso con datos: cuánto queda del total inicial. */
  pctOfTop: number;
  /** % respecto al paso anterior: dónde está la fuga concreta. */
  pctOfPrev: number;
}

const STEPS: { key: FunnelEvent; label: string }[] = [
  { key: 'intro_start', label: 'Abren la app' },
  { key: 'intro_done', label: 'Terminan la intro' },
  { key: 'register_view', label: 'Ven el registro' },
  { key: 'register_submit', label: 'Pulsan crear cuenta' },
  { key: 'register_ok', label: 'Cuenta creada' },
  // La cuenta creada ya no es el final del embudo: entre ella y usar la app
  // está el alta de 1 €, que es justo donde más gente se puede caer.
  { key: 'entry_wall_view', label: 'Ven el alta' },
  { key: 'checkout_start', label: 'Pulsan pagar' },
];

/**
 * Convierte los contadores en un embudo con sus dos porcentajes. El de "paso
 * anterior" es el que señala dónde está el problema: un 20 % ahí es una fuga
 * concreta que se puede arreglar.
 */
export function buildFunnel(totals: Record<string, number>): FunnelStep[] {
  const top = totals[STEPS[0].key] ?? 0;
  let prev = 0;
  return STEPS.map((s, i) => {
    const value = totals[s.key] ?? 0;
    const step: FunnelStep = {
      ...s,
      value,
      pctOfTop: top > 0 ? Math.round((value / top) * 100) : 0,
      pctOfPrev: i === 0 ? 100 : prev > 0 ? Math.round((value / prev) * 100) : 0,
    };
    prev = value;
    return step;
  });
}
