import { limpiaDictado } from './dictado';
import { entiendeDictado } from './dictadoLocal';
import type { Dictado, EjercicioDelCatalogo } from './dictado';

/**
 * Entender lo dictado y devolverlo listo para la pantalla.
 *
 * SE ENTIENDE AQUÍ, EN EL MÓVIL, SIN SERVIDOR
 *
 * Antes esto salía a un servidor que hablaba con un modelo de lenguaje. Ya no:
 * lo entiende `lib/dictadoLocal`, y el cambio se nota en tres cosas que
 * importan más que la elegancia de la solución.
 *
 *  - NO CUESTA DINERO. Cada dictado era una llamada de pago. Una función que
 *    cuesta por uso acaba con un tope por usuario, y un tope es un "hoy no
 *    puedes" en la cara de alguien que solo quería contar su entreno.
 *  - FUNCIONA SIN COBERTURA. En medio gimnasio no hay línea. Justo donde se
 *    usa esto.
 *  - CONTESTA AL INSTANTE, sin los dos segundos de ir y volver.
 *
 * A cambio entiende menos florituras. Por eso lo entendido SIEMPRE se enseña
 * antes de guardar: ahí se corrige en un toque, y sale más barato que esperar
 * a que lo adivine un modelo.
 *
 * `limpiaDictado` sigue en medio, igual que cuando lo de enfrente era una IA:
 * un ejercicio que no está en el catálogo o una marca imposible no entran.
 * Desconfiar del parser propio cuesta lo mismo que desconfiar de un modelo, y
 * un fallo aquí no puede acabar guardando series que nadie hizo.
 */

export interface ResultadoDictado {
  dictado?: Dictado;
  error?: string;
}

export async function apuntarEntrenoDictado(
  texto: string,
  catalogo: EjercicioDelCatalogo[]
): Promise<ResultadoDictado> {
  const limpio = texto.trim();
  if (!limpio) return { error: 'Cuéntame primero qué hiciste.' };
  if (catalogo.length === 0) return { error: 'Sin ejercicios que reconocer' };
  // Sigue siendo asíncrona porque la pantalla la espera con su "escuchando" y
  // porque nada obliga a que entender un dictado sea instantáneo para siempre.
  return { dictado: limpiaDictado(entiendeDictado(limpio, catalogo), catalogo) };
}
