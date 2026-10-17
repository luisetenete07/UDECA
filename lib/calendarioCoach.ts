import type { Ionicons } from '@expo/vector-icons';
import { nombreDeCiclo } from './cyclePlan';
import { horaCorta, inicioDelDia } from './fechas';
import type { Llamada } from './llamadas';
import { frase } from './idioma';
import { colors } from './theme';
import {
  CYCLE_LEVEL_LABEL,
  type CoachTask,
  type TrainingCycle,
  type UserProfile,
} from './types';

/**
 * Lo que sale en el calendario del entrenador, día a día.
 *
 * Está aquí, y no dentro de la pantalla del calendario, porque ahora lo pintan
 * DOS sitios: el calendario entero (app/(trainer)/agenda.tsx) y la semana del
 * inicio (components/SemanaDelCoach.tsx). Escrito dos veces, el día que uno
 * aprendiera un tipo de evento nuevo el otro no lo enseñaría, y el entrenador
 * vería una semana distinta según por dónde entrara.
 */

/** 'payment' es el fin del periodo de coaching (el nombre es de antes). */
export type TipoDeEvento = 'payment' | 'cycle-start' | 'cycle-end' | 'task' | 'call';

export interface EventoDelCalendario {
  /** Inicio del día (00:00) en que cae. */
  day: number;
  type: TipoDeEvento;
  title: string;
  subtitle?: string;
  /** A dónde lleva al tocarlo, si lleva a algún sitio. */
  ruta?: string;
  /** Si es una tarea, cuál. */
  tarea?: CoachTask;
  /** Si es una llamada, cuál (y su hora, para ordenarlas en el día). */
  llamada?: Llamada;
}

export const TONO_DEL_EVENTO: Record<TipoDeEvento, string> = {
  payment: colors.danger,
  'cycle-start': colors.primary,
  'cycle-end': colors.primaryBright,
  task: colors.textMuted,
  call: colors.success,
};

export const ICONO_DEL_EVENTO: Record<TipoDeEvento, keyof typeof Ionicons.glyphMap> = {
  payment: 'calendar-outline',
  'cycle-start': 'play-outline',
  'cycle-end': 'flag-outline',
  task: 'checkbox-outline',
  call: 'call-outline',
};

/** Una tarea "de día" sin fecha se entiende para hoy. */
export function diaDeLaTarea(t: CoachTask, ahora: number = Date.now()): number {
  return inicioDelDia(t.dueDate ?? ahora);
}

/**
 * Todos los eventos del calendario, agrupados por día: fin de coaching de cada
 * alumno, inicio y fin de sus ciclos, las tareas de día sin terminar y las
 * llamadas 1:1 que han reservado sus alumnos (estas, las primeras del día y
 * por hora: son lo único con hora fija).
 */
export function eventosPorDia(
  clients: UserProfile[],
  cycles: TrainingCycle[],
  tareas: CoachTask[],
  ahora: number = Date.now(),
  llamadas: Llamada[] = []
): Map<number, EventoDelCalendario[]> {
  const map = new Map<number, EventoDelCalendario[]>();
  const add = (e: EventoDelCalendario) => map.set(e.day, [...(map.get(e.day) ?? []), e]);
  for (const c of clients) {
    if (c.nextPaymentDate) {
      add({
        day: inicioDelDia(c.nextPaymentDate),
        type: 'payment',
        title: frase`Fin del coaching · ${c.name}`,
        subtitle: frase`Renovar`,
        ruta: `/(trainer)/clients/${c.uid}`,
      });
    }
  }
  for (const cy of cycles) {
    const who = clients.find((c) => c.uid === cy.clientId)?.name ?? 'alumno';
    const ruta = `/(trainer)/clients/${cy.clientId}/cycles/${cy.id}`;
    if (cy.startDate)
      add({
        day: inicioDelDia(cy.startDate),
        type: 'cycle-start',
        title: frase`Empieza ${nombreDeCiclo(cy.name)}`,
        subtitle: `${CYCLE_LEVEL_LABEL[cy.level]} · ${who}`,
        ruta,
      });
    if (cy.endDate)
      add({
        day: inicioDelDia(cy.endDate),
        type: 'cycle-end',
        title: frase`Termina ${nombreDeCiclo(cy.name)}`,
        subtitle: `${CYCLE_LEVEL_LABEL[cy.level]} · ${who}`,
        ruta,
      });
  }
  for (const l of [...llamadas].sort((a, b) => a.inicio - b.inicio)) {
    const quien = clients.find((c) => c.uid === l.clientId)?.name ?? 'alumno';
    add({
      day: inicioDelDia(l.inicio),
      type: 'call',
      title: frase`Llamada · ${quien}`,
      subtitle: `${horaCorta(l.inicio)} – ${horaCorta(l.fin)}`,
      ruta: `/(trainer)/clients/${l.clientId}`,
      llamada: l,
    });
  }
  for (const t of tareas) {
    if (t.scope !== 'day' || t.done) continue;
    add({
      day: diaDeLaTarea(t, ahora),
      type: 'task',
      title: t.title,
      subtitle: 'Tarea · toca para mover de día',
      tarea: t,
    });
  }
  // Las llamadas, delante: tienen hora y son con alguien.
  for (const [dia, lista] of map) {
    map.set(dia, [...lista.filter((e) => e.type === 'call'), ...lista.filter((e) => e.type !== 'call')]);
  }
  return map;
}
