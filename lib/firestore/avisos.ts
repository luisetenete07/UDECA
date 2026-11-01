import { addDoc, collection, getDocs, query, serverTimestamp, Timestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { stripUndefined } from './clean';
import type { AvisoDelPlan, CambiosDelPlan } from '../avisosDelPlan';

/**
 * Las notificaciones del alumno (`avisosDelPlan/{auto}`, lib/avisosDelPlan.ts).
 *
 * Las apunta su ENTRENADOR al guardarle el plan, con la hora del servidor, y
 * nadie las cambia después (las reglas no dejan). El alumno las lee y lo que
 * ya ha visto se guarda en su perfil (`avisosVistos`), no en cada aviso.
 */

/** Cuántos días atrás se enseñan. */
export const DIAS_DE_AVISOS = 60;

/** Un aviso de verdad no lleva más días que estos (las reglas lo exigen). */
export const MAX_DIAS_POR_AVISO = 40;

export async function apuntarAvisoDelPlan(a: {
  trainerId: string;
  clientId: string;
  routineId: string;
  plan: string;
  nuevo: boolean;
  cambios: CambiosDelPlan;
}): Promise<void> {
  await addDoc(collection(db, 'avisosDelPlan'), {
    ...stripUndefined({
      trainerId: a.trainerId,
      clientId: a.clientId,
      tipo: 'plan',
      routineId: a.routineId,
      plan: a.plan.slice(0, 120),
      nuevo: a.nuevo,
      dias: a.cambios.dias.slice(0, MAX_DIAS_POR_AVISO),
      ajustes: a.cambios.ajustes,
    }),
    // FUERA de stripUndefined: la limpieza rehace cada objeto campo a campo y
    // la marca de "hora del servidor" dejaría de serlo (las reglas la exigen).
    cuando: serverTimestamp(),
  });
}

/** Los de los últimos días, del más nuevo al más viejo. */
export async function getAvisosDelAlumno(clientId: string, ahora = Date.now()): Promise<AvisoDelPlan[]> {
  const snap = await getDocs(
    query(
      collection(db, 'avisosDelPlan'),
      where('clientId', '==', clientId),
      where('cuando', '>=', Timestamp.fromMillis(ahora - DIAS_DE_AVISOS * 86_400_000))
    )
  );
  return snap.docs
    .map((x) => {
      const d = x.data();
      return {
        id: x.id,
        trainerId: String(d.trainerId ?? ''),
        clientId: String(d.clientId ?? ''),
        tipo: 'plan' as const,
        routineId: String(d.routineId ?? ''),
        plan: String(d.plan ?? ''),
        nuevo: d.nuevo === true,
        dias: Array.isArray(d.dias) ? d.dias : [],
        ajustes: Array.isArray(d.ajustes) ? d.ajustes : [],
        // Recién escrito, la hora del servidor aún no ha vuelto: es ahora.
        cuando: d.cuando instanceof Timestamp ? d.cuando.toMillis() : Number(d.cuando ?? ahora),
      };
    })
    .sort((a, b) => b.cuando - a.cuando);
}
