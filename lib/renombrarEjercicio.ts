/**
 * Cuando un ejercicio cambia de nombre, quién más tiene que enterarse.
 *
 * POR QUÉ EL NOMBRE ESTÁ ESCRITO EN DOS SITIOS
 *
 * La rutina de un alumno no guarda una referencia al ejercicio y ya: guarda
 * `exerciseId` Y una copia del nombre. Eso no es un descuido, es lo que hace
 * que la pantalla de entreno se pinte con UNA lectura —la rutina— en vez de
 * tener que traerse la biblioteca entera del entrenador para poder escribir
 * "Dominadas" encima de la primera serie.
 *
 * El precio de esa copia es este fichero. El día que el entrenador corrige
 * "Dominads" a "Dominadas", la biblioteca queda bien y las rutinas siguen con
 * la falta puesta. Hasta ahora la única salida era quitar el ejercicio del plan
 * y volverlo a poner, alumno por alumno.
 *
 * QUÉ SE ACTUALIZA Y QUÉ NO
 *
 * Se actualiza donde el nombre es una ETIQUETA de algo que sigue vivo: las
 * rutinas, las plantillas y los objetivos de los ciclos.
 *
 * NO se tocan los entrenamientos ya registrados (`workoutLogs`). Ahí el nombre
 * es parte de un hecho fechado: el 14 de marzo se hicieron ocho repeticiones de
 * lo que aquel día se llamaba así. Reescribir el pasado para que cuadre con el
 * presente es justo lo que no debe hacer un historial.
 *
 * El VÍDEO no aparece por aquí, y es a propósito: en la rutina no hay copia del
 * enlace. Se lee siempre de la biblioteca por `exerciseId` (ver
 * `videoByExercise` en la pantalla de entreno), así que cambiarlo ya se veía al
 * momento sin que nadie tuviera que propagar nada.
 *
 * Las funciones devuelven `null` cuando no hay nada que cambiar. Eso no es un
 * detalle de estilo: es lo que permite al que llama escribir SOLO los
 * documentos afectados en vez de reescribir la rutina de los cuarenta alumnos
 * cada vez que se toca un ejercicio.
 */
import type { ObjetivoDeCiclo, RoutineDay } from './types';

/**
 * Los días de una rutina con el ejercicio renombrado.
 *
 * `null` si ninguno lo tiene, o si ya se llamaban todos así.
 */
export function diasRenombrados(
  dias: RoutineDay[] | undefined,
  ejercicioId: string,
  nombre: string
): RoutineDay[] | null {
  if (!dias?.length || !ejercicioId || !nombre) return null;
  let tocado = false;
  const nuevos = dias.map((dia) => {
    if (!dia.exercises?.length) return dia;
    let tocadoAqui = false;
    const ejercicios = dia.exercises.map((ex) => {
      if (ex.exerciseId !== ejercicioId || ex.name === nombre) return ex;
      tocadoAqui = true;
      return { ...ex, name: nombre };
    });
    if (!tocadoAqui) return dia;
    tocado = true;
    return { ...dia, exercises: ejercicios };
  });
  return tocado ? nuevos : null;
}

/**
 * Los objetivos de un ciclo con el ejercicio renombrado.
 *
 * El objetivo guarda su propia copia del nombre por lo mismo que la rutina: se
 * pinta sin ir a buscar nada. Y aquí se nota más, porque un objetivo se lee
 * muchas veces y se toca casi nunca.
 */
export function objetivosRenombrados(
  objetivos: ObjetivoDeCiclo[] | undefined,
  ejercicioId: string,
  nombre: string
): ObjetivoDeCiclo[] | null {
  if (!objetivos?.length || !ejercicioId || !nombre) return null;
  let tocado = false;
  const nuevos = objetivos.map((o) => {
    if (o.ejercicioId !== ejercicioId || o.nombre === nombre) return o;
    tocado = true;
    return { ...o, nombre };
  });
  return tocado ? nuevos : null;
}
