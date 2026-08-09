import { EXERCISE_MEASURES, type Exercise, type ExerciseMeasure } from './types';

/**
 * La medida (reps, segundos, combo…) decidida para todo un grupo de ejercicios.
 *
 * Un entrenador que organiza su biblioteca no piensa ejercicio a ejercicio:
 * piensa "el grupo Aguantes de Planche va en segundos". Antes había que
 * repetir esa decisión en cada ficha, y bastaba olvidarla una vez para que un
 * isométrico apareciera pidiendo repeticiones en mitad del entreno —donde ya
 * no se puede arreglar—. Ahora se dice una vez por grupo y vale para todo lo
 * que caiga dentro, incluido lo que se añada después.
 *
 * CÓMO SE GUARDA, Y POR QUÉ TAMBIÉN EN CADA EJERCICIO
 *
 * La decisión vive en el perfil del ENTRENADOR (`subgroupMeasures`), que es de
 * quien es. Pero el alumno no lee el perfil de su entrenador: lee los
 * ejercicios y su rutina. Así que, además de guardarse en el grupo, la medida
 * se ESCRIBE en cada ejercicio del grupo (ver `ejerciciosADesactualizar`). El
 * grupo es quien manda y quien recuerda; la copia en el ejercicio es lo que
 * hace que el resto de la app —rutinas, histórico, estadísticas— siga leyendo
 * un único campo, sin enterarse de que existen los grupos.
 */

/**
 * Clave de un grupo. Categoría y subgrupo, porque "Aguantes" existe en varias.
 *
 * Las dos partes van escapadas, y el punto también: esto acaba siendo el
 * nombre de un campo dentro de un mapa de Firestore, donde el punto y la barra
 * significan "baja un nivel". Una categoría llamada "Push / Pull" partiría la
 * clave en dos y la medida se guardaría en un sitio del que nadie volvería a
 * leerla.
 */
const escapa = (s: string) => encodeURIComponent(s).replace(/\./g, '%2E');

export function claveGrupo(categoria: string, subgrupo: string): string {
  return `${escapa(categoria)}|${escapa(subgrupo)}`;
}

/** La medida elegida para ese grupo, si se eligió alguna. */
export function medidaDelGrupo(
  mapa: Record<string, ExerciseMeasure> | undefined,
  categoria: string,
  subgrupo: string
): ExerciseMeasure | undefined {
  if (!subgrupo) return undefined;
  const m = mapa?.[claveGrupo(categoria, subgrupo)];
  return EXERCISE_MEASURES.includes(m as ExerciseMeasure) ? (m as ExerciseMeasure) : undefined;
}

/**
 * La medida que le toca a un ejercicio: manda su grupo, y si su grupo no lo
 * ha decidido, la suya. Sin nada, repeticiones, que es lo más común.
 */
export function medidaEfectiva(
  ejercicio: Pick<Exercise, 'muscleGroup' | 'subgroup' | 'measure'>,
  mapa?: Record<string, ExerciseMeasure>
): ExerciseMeasure {
  const delGrupo = medidaDelGrupo(mapa, ejercicio.muscleGroup, ejercicio.subgroup ?? '');
  if (delGrupo) return delGrupo;
  return EXERCISE_MEASURES.includes(ejercicio.measure as ExerciseMeasure)
    ? (ejercicio.measure as ExerciseMeasure)
    : 'reps';
}

/** El mapa con la medida de ese grupo puesta. */
export function conMedidaDeGrupo(
  mapa: Record<string, ExerciseMeasure> | undefined,
  categoria: string,
  subgrupo: string,
  medida: ExerciseMeasure
): Record<string, ExerciseMeasure> {
  return { ...(mapa ?? {}), [claveGrupo(categoria, subgrupo)]: medida };
}

/**
 * El mapa sin ese grupo: vuelve a decidirse ejercicio a ejercicio.
 *
 * Los ejercicios NO se tocan al quitarla. Se quedan con la medida que tenían,
 * que es la que el entrenador había elegido para el grupo: soltar el grupo es
 * dejar de imponerla a los que vengan, no borrar lo ya decidido.
 */
export function sinMedidaDeGrupo(
  mapa: Record<string, ExerciseMeasure> | undefined,
  categoria: string,
  subgrupo: string
): Record<string, ExerciseMeasure> {
  const salida = { ...(mapa ?? {}) };
  delete salida[claveGrupo(categoria, subgrupo)];
  return salida;
}

/**
 * El mapa con un grupo renombrado.
 *
 * Sin esto, renombrar "Aguantes" a "Isométricos" perdería su medida en
 * silencio y los ejercicios que se añadieran después volverían a repeticiones.
 */
export function grupoRenombrado(
  mapa: Record<string, ExerciseMeasure> | undefined,
  categoria: string,
  de: string,
  a: string
): Record<string, ExerciseMeasure> {
  const medida = medidaDelGrupo(mapa, categoria, de);
  const salida = sinMedidaDeGrupo(mapa, categoria, de);
  return medida ? { ...salida, [claveGrupo(categoria, a)]: medida } : salida;
}

/**
 * Los ejercicios de un grupo cuya medida no coincide con la del grupo.
 *
 * Es la lista de los que hay que reescribir al cambiar la medida del grupo.
 * Se devuelven solo los que cambian de verdad: escribir los demás sería gastar
 * una escritura de Firestore por ejercicio para dejarlo exactamente igual.
 */
export function ejerciciosADesactualizar(
  ejercicios: Exercise[],
  categoria: string,
  subgrupo: string,
  medida: ExerciseMeasure
): Exercise[] {
  if (!subgrupo) return [];
  return ejercicios.filter(
    (e) => e.muscleGroup === categoria && (e.subgroup ?? '') === subgrupo && e.measure !== medida
  );
}
