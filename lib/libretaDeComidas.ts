import type { MealBookPhoto } from './types';

/**
 * Los comentarios del entrenador en las fotos de la libreta.
 *
 * Una foto de un plato dice qué hay, pero no dice lo que el entrenador quiere
 * decir: cuánto arroz es eso, con qué se puede cambiar el pollo, por qué esa
 * comida va después de entrenar. Eso lo contaba por WhatsApp, o no lo contaba.
 *
 * Aquí no hay pantalla ni Firebase a propósito: es aritmética de textos y de
 * listas, y así se puede probar de verdad desde un guardián en vez de leyendo
 * el fichero a ver si pone lo que debe.
 */

/**
 * Hasta dónde se puede escribir.
 *
 * No es una manía de brevedad, son dos límites reales. Uno: las fotos van
 * comprimidas DENTRO del documento de la libreta, y Firestore corta cada
 * documento en 1 MB — doce fotos ya van justas, y el texto suma. Dos: el
 * alumno lee esto bajo una foto de 130 px de ancho; un párrafo ahí no se lee,
 * se salta.
 *
 * 200 caracteres son dos o tres frases, que es exactamente lo que cabe decir
 * de un plato.
 */
export const LARGO_DEL_COMENTARIO = 200;

/**
 * El texto tal y como se va a guardar.
 *
 * Se quitan los espacios repetidos y los saltos de línea de más (pegar desde
 * las notas del móvil los trae a pares), se recorta por los extremos y se
 * corta al tope. El corte va AL FINAL, después de limpiar: si se cortara
 * antes, los espacios sobrantes se comerían letras que sí caben.
 */
export function limpiarComentario(texto: string): string {
  return texto
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .replace(/ *\n */g, '\n')
    .trim()
    .slice(0, LARGO_DEL_COMENTARIO)
    .trim();
}

/**
 * Deja el comentario puesto en una foto y devuelve la lista nueva.
 *
 * VACÍO SIGNIFICA BORRARLO, y borrarlo es QUITAR LA CLAVE, no dejarla a `''`.
 * Suena a detalle y no lo es: el alumno la pinta con `{p.caption ? ... : null}`
 * —una cadena vacía no pasa esa condición, así que ahí no se notaría— pero el
 * campo vacío se queda escrito en Firestore para siempre, ocupando sitio en un
 * documento que ya compite con doce fotos por el megabyte que le dan. Multiplí-
 * calo por las libretas de todos los entrenadores.
 *
 * Y no se muta la lista de entrada: la pantalla la tiene en su estado y la
 * pinta antes de que Firestore conteste. Si se tocara aquí, el estado y lo
 * guardado dejarían de ser lo mismo en cuanto la escritura fallara, y volver
 * atrás ya no sería posible.
 */
export function conComentario(
  fotos: readonly MealBookPhoto[],
  idDeLaFoto: string,
  texto: string
): MealBookPhoto[] {
  const limpio = limpiarComentario(texto);
  return fotos.map((foto) => {
    if (foto.id !== idDeLaFoto) return foto;
    const { caption: _viejo, ...resto } = foto;
    return limpio ? { ...resto, caption: limpio } : resto;
  });
}

/**
 * ¿Se va a cortar bajo la miniatura?
 *
 * El alumno ve el comentario recortado a tres renglones en una columna de
 * 130 px, y debajo un "Toca para leerlo". Ese aviso solo tiene sentido si de
 * verdad falta texto por ver: puesto siempre, es una promesa vacía debajo de
 * una frase que ya se lee entera, y a la tercera nadie lo toca.
 *
 * A 11 px en 130 px de ancho entran unos 24 caracteres por renglón. Tres
 * renglones son 72. Es una estimación, no una medida —depende de la letra que
 * toque— así que se queda corta a propósito: avisar de más molesta, avisar de
 * menos esconde lo que el entrenador ha escrito.
 */
export const LARGO_QUE_CABE = 72;

export function seCorta(comentario: string | undefined): boolean {
  const texto = (comentario ?? '').trim();
  return texto.length > LARGO_QUE_CABE || texto.split('\n').length > 3;
}

/** Cuántas fotos de la libreta llevan algo escrito. Para el contador del coach. */
export function cuantasComentadas(fotos: readonly MealBookPhoto[]): number {
  return fotos.filter((f) => (f.caption ?? '').trim().length > 0).length;
}
