import { diasEntre, inicioDelDia } from './fechas';
import { frase, t } from './idioma';
import { nombreDelDia } from './schedule';
import type { Routine, WorkoutLog } from './types';

/**
 * Cuál fue el último día que entrenaste, y por dónde sigue el plan.
 *
 * POR QUÉ HACE FALTA
 *
 * Un plan por ciclos no va por el calendario: va por su orden. Si el ciclo son
 * cinco días y esta semana te saltas dos, el ciclo sigue rodando sin ti y al
 * volver te encuentras en el Día 4 sin haber hecho el 2 ni el 3. La app lo
 * calculaba bien —cuenta los días desde el ancla—, pero no lo CONTABA: no había
 * ninguna pantalla que dijera "lo último que hiciste fue el Día 1, hace seis
 * días".
 *
 * Sin ese dato, la única salida era reiniciar el ciclo entero y volver al Día
 * 1, tirando a la basura lo que ya llevabas hecho.
 *
 * En el plan semanal el problema no existe —manda el día de la semana— pero
 * saber cuándo entrenaste por última vez sigue valiendo, y por eso esto
 * funciona igual para los dos.
 *
 * CÓMO SE EMPAREJA UN ENTRENO CON UN DÍA DEL PLAN
 *
 * Por el nombre, que es lo único que guarda el registro (`WorkoutLog.dayName`).
 * No es perfecto —dos días del ciclo pueden llamarse igual—, pero es lo que
 * hay, y en el peor caso se acierta el primero de los dos, que es exactamente
 * lo que uno diría mirando su propio historial. Sin `dayId` en el registro, la
 * alternativa sería inventarse una correspondencia.
 */

export interface UltimoEntreno {
  /** El registro, tal cual. */
  log: WorkoutLog;
  /** Posición dentro de `routine.days`, si se ha podido emparejar. */
  indice: number | null;
  /** Cómo se llama ese día, ya escrito. */
  nombre: string;
  /** Días naturales desde entonces. 0 = hoy. */
  hace: number;
}

/**
 * El último entreno de ESTA rutina.
 *
 * De esta rutina y no el último de todos: quien cambia de plan no quiere que le
 * digan por dónde iba el anterior.
 */
export function ultimoEntrenoDe(
  logs: WorkoutLog[],
  routine: Routine | null,
  ahora = Date.now()
): UltimoEntreno | null {
  if (!routine || routine.days.length === 0) return null;
  const mios = logs
    .filter((l) => l.routineId === routine.id)
    .sort((a, b) => b.date - a.date);
  const log = mios[0];
  if (!log) return null;

  const buscado = (log.dayName ?? '').trim().toLowerCase();
  const i = routine.days.findIndex((d) => (d.name ?? '').trim().toLowerCase() === buscado);
  const indice = i >= 0 ? i : null;

  return {
    log,
    indice,
    nombre: indice !== null ? nombreDelDia(routine.days[indice].name, indice) : log.dayName,
    hace: Math.max(0, diasEntre(inicioDelDia(log.date), inicioDelDia(ahora))),
  };
}

/**
 * El día por el que SIGUE el ciclo: el de después del último que entrenaste.
 *
 * Da la vuelta al final, porque un ciclo es un círculo: después del último día
 * viene otra vez el primero. Devuelve `null` si no se supo de qué día venía —
 * ofrecer "sigue por el Día 1" a quien no sabemos dónde está es reiniciarle el
 * ciclo sin decírselo.
 */
export function siguienteDelCiclo(
  ultimo: UltimoEntreno | null,
  totalDias: number
): number | null {
  if (!ultimo || ultimo.indice === null || totalDias <= 0) return null;
  return (ultimo.indice + 1) % totalDias;
}

/**
 * "hoy", "ayer", "hace 6 días". En palabras, que es como lo piensa cualquiera.
 *
 * No se dice la fecha: "el 12 de agosto" obliga a hacer la cuenta, y la cuenta
 * es justo el dato que se quiere ("cuánto llevo sin entrenar").
 */
export function haceCuanto(dias: number): string {
  if (dias <= 0) return t('hoy');
  if (dias === 1) return t('ayer');
  return frase`hace ${dias} días`;
}
