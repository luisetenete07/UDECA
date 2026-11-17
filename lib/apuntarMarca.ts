import { esMismoDia } from './fechas';
import { isHoldMeasure, type ExerciseMeasure, type LoggedExercise, type WorkoutLog } from './types';

/**
 * APUNTAR UNA MARCA (components/ApuntarMarca.tsx). No confundir con lib/marcas.ts,
 * que cuenta las marcas superadas para la clasificación del grupo.
 *
 * Sin entreno en directo (lib/modoDeEntreno.ts), el alumno apunta lo que
 * quiere, cuando quiere: "hoy 12 dominadas", "40 s de front lever". Es
 * opcional y no cierra nada.
 *
 * Se guarda como un entreno más (`workoutLogs`) a propósito. Así sale en
 * Progreso, en sus récords y en su historial sin tocar nada de eso, y le llega
 * a su entrenador en "Por revisar" como cualquier otro.
 *
 * Las marcas del mismo día y del mismo día de rutina van JUNTAS en un solo
 * registro. Cinco marcas sueltas de un martes son un martes, no cinco
 * entrenos: si no, el historial se llenaría de sesiones de un ejercicio.
 */

export interface Marca {
  exerciseId: string;
  name: string;
  measure?: ExerciseMeasure;
  load?: LoggedExercise['load'];
  /** Repeticiones o, en los isométricos, segundos. */
  valor: string;
  /** Kilos de lastre (o de ayuda, con goma). */
  kg?: string;
  nota?: string;
}

/** Solo cifras, con coma o punto: "12", "7,5". Lo demás no es una marca. */
export function limpiarCifra(texto: string): string {
  const t = texto.replace(',', '.').trim();
  return /^\d{1,4}(\.\d{1,2})?$/.test(t) ? t : '';
}

/** ¿Se puede guardar? Hace falta la cifra principal. */
export function marcaValida(m: Pick<Marca, 'valor'>): boolean {
  return limpiarCifra(m.valor) !== '' && Number(limpiarCifra(m.valor)) > 0;
}

/** Qué se pregunta según el ejercicio: segundos en los isométricos. */
export function queSePide(measure: ExerciseMeasure | undefined): 'segundos' | 'repeticiones' {
  return isHoldMeasure(measure) ? 'segundos' : 'repeticiones';
}

/** La marca, como un ejercicio con una serie hecha. */
export function ejercicioDeLaMarca(m: Marca): LoggedExercise {
  const kg = m.kg ? limpiarCifra(m.kg) : '';
  const nota = m.nota?.trim();
  return {
    exerciseId: m.exerciseId,
    name: m.name,
    ...(m.measure ? { measure: m.measure } : {}),
    ...(m.load ? { load: m.load } : {}),
    sets: [{ reps: limpiarCifra(m.valor), ...(kg ? { weight: kg } : {}), completed: true }],
    ...(nota ? { notes: nota } : {}),
  };
}

/**
 * Los ejercicios de un registro con la marca nueva dentro.
 *
 * Si el ejercicio ya está, la marca es una serie más y la nota se suma a la
 * que hubiera; si no, el ejercicio entra al final. No se toca nada más: lo
 * que ya estaba apuntado se queda tal cual.
 */
export function conMarca(ejercicios: LoggedExercise[], m: Marca): LoggedExercise[] {
  const nuevo = ejercicioDeLaMarca(m);
  const i = ejercicios.findIndex((e) => e.exerciseId === m.exerciseId);
  if (i < 0) return [...ejercicios, nuevo];
  return ejercicios.map((e, j) => {
    if (j !== i) return e;
    const notas = [e.notes?.trim(), nuevo.notes].filter(Boolean).join(' · ');
    return { ...e, sets: [...e.sets, ...nuevo.sets], ...(notas ? { notes: notas } : {}) };
  });
}

/**
 * El registro de HOY donde va la marca: el del mismo día de rutina.
 *
 * Los de grease the groove no: esos llevan su objetivo del día y se cuentan
 * de otra manera.
 */
export function registroDeHoy(
  logs: WorkoutLog[],
  routineId: string,
  dayName: string,
  ahora = Date.now()
): WorkoutLog | undefined {
  return logs.find(
    (l) => !l.gtg && l.routineId === routineId && l.dayName === dayName && esMismoDia(l.date, ahora)
  );
}
