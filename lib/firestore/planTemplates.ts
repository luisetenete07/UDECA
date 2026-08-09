import { inicioDeLaSemana } from '../fechas';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { stripUndefined } from './clean';
import { db } from '../firebase';
import { writePlan } from './cycles';
import { cyclesFromTemplate, templateFromCycles, type PlanTemplate } from '../planTemplates';

import type { TrainingCycle, WeekPlanEntry } from '../types';

const collectionRef = () => collection(db, 'planTemplates');

export async function getPlanTemplates(trainerId: string): Promise<PlanTemplate[]> {
  const snap = await getDocs(query(collectionRef(), where('trainerId', '==', trainerId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as PlanTemplate)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Guarda un plan existente como plantilla reutilizable. */
export async function savePlanAsTemplate(
  trainerId: string,
  root: TrainingCycle,
  all: TrainingCycle[],
  name: string
): Promise<string> {
  const plantilla = templateFromCycles(root, all, name);
  const ref = await addDoc(
    collectionRef(),
    // `stripUndefined` no entra en los arrays, así que las semanas se limpian
    // aparte: Firestore rechaza `undefined` también ahí dentro.
    stripUndefined({
      trainerId,
      name: plantilla.name,
      goal: plantilla.goal,
      blocks: plantilla.blocks.map((b) => ({
        name: b.name,
        ...(b.goal ? { goal: b.goal } : {}),
        weeks: b.weeks.map((w) => ({
          name: w.name,
          ...(w.isDeload ? { isDeload: true } : {}),
          ...(w.targetSessions != null ? { targetSessions: w.targetSessions } : {}),
          ...(w.weekPlan?.length ? { weekPlan: w.weekPlan } : {}),
        })),
      })),
      createdAt: Date.now(),
    })
  );
  return ref.id;
}


/** Monta la plantilla en un alumno a partir de una fecha. Devuelve el macro. */
export async function applyPlanTemplate(
  trainerId: string,
  clientId: string,
  template: PlanTemplate,
  startDate: number
): Promise<string> {
  return writePlan(trainerId, clientId, cyclesFromTemplate(template, startDate));
}

/**
 * Copia la programación de una semana a la misma semana de otros alumnos.
 *
 * Los ejercicios son los de la biblioteca del entrenador, la misma para todos
 * sus alumnos, así que los números viajan sin traducir nada. Si alguno no tiene
 * microciclo esa semana se le salta —no se le inventa un ciclo— y se devuelve
 * a cuántos les llegó de verdad, para poder decirlo sin mentir.
 */
export async function applyWeekToClients(
  weekStart: number,
  weekPlan: WeekPlanEntry[],
  cyclesByClient: { clientId: string; cycles: TrainingCycle[] }[]
): Promise<{ aplicados: number; sinSemana: string[] }> {
  const lunes = inicioDeLaSemana(weekStart);
  const batch = writeBatch(db);
  const sinSemana: string[] = [];
  let aplicados = 0;

  for (const { clientId, cycles } of cyclesByClient) {
    const micro = cycles.find(
      (c) => c.level === 'micro' && c.startDate != null && inicioDeLaSemana(c.startDate) === lunes
    );
    if (!micro) {
      sinSemana.push(clientId);
      continue;
    }
    batch.update(doc(db, 'trainingCycles', micro.id), { weekPlan, updatedAt: Date.now() });
    aplicados++;
  }

  if (aplicados > 0) await batch.commit();
  return { aplicados, sinSemana };
}
