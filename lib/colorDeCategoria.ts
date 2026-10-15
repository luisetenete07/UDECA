import { CATEGORY_PALETTE } from './types';

/**
 * El color de una categoría de ejercicios del entrenador.
 *
 * El que haya elegido él; si no eligió ninguno, la paleta repartida por
 * posición, para que dos categorías nunca salgan del mismo color por
 * accidente. Lo usan la biblioteca y la ficha de cada ejercicio: si cada una
 * lo calculara a su manera, la misma categoría saldría de dos colores.
 */
export function colorDeCategoria(
  elegidos: Record<string, string> | undefined,
  categorias: readonly string[],
  categoria: string
): string {
  return (
    elegidos?.[categoria] ??
    CATEGORY_PALETTE[Math.max(0, categorias.indexOf(categoria)) % CATEGORY_PALETTE.length]
  );
}
