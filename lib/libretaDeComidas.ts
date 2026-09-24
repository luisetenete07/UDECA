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

// ===========================================================================
// LA DESCRIPCIÓN DE CADA ÁLBUM
// ===========================================================================

/**
 * Lo que el entrenador cuenta de un álbum entero ("Desayunos", "Post-entreno"):
 * cuándo se toman, cuántas calorías rondan, cómo elegir entre ellos.
 *
 * El comentario de cada foto habla de ESE plato; esto habla de todos a la vez,
 * y es lo que faltaba para no repetir lo mismo debajo de doce fotos.
 *
 * Más largo que un comentario porque se lee a lo ancho de la tarjeta, no en
 * una columna de 130 px; pero con tope por el mismo megabyte del documento.
 */
export const LARGO_DE_LA_DESCRIPCION = 400;

export function limpiarDescripcion(texto: string): string {
  return (texto ?? '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ *\n */g, '\n')
    .trim()
    .slice(0, LARGO_DE_LA_DESCRIPCION)
    .trim();
}

// ===========================================================================
// LA RECETA EN PDF DE CADA FOTO (OPCIONAL)
// ===========================================================================

/**
 * El enlace a la receta en PDF, tal y como se va a guardar, o '' si no vale.
 *
 * ES UN ENLACE, NO UN ARCHIVO SUBIDO. Las fotos van dentro del documento de la
 * libreta y ahí un PDF no cabe; subirlo exigiría montar un almacén de
 * archivos aparte. Con un enlace de Drive, Dropbox o cualquier web, funciona
 * igual que los e-books de los cursos y se abre con el mismo lector.
 *
 * Solo http(s): cualquier otra cosa (un "javascript:", una ruta del móvil) no
 * es un documento que el alumno pueda abrir, y guardarla sería prometerle una
 * receta que no está.
 */
export function limpiarEnlaceDeReceta(texto: string): string {
  const limpio = (texto ?? '').trim();
  if (!limpio) return '';
  let url: URL;
  try {
    url = new URL(limpio);
  } catch {
    return '';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
  return limpio.slice(0, 1000);
}

/** ¿Lo escrito es un enlace que no sirve? Vacío no cuenta: vacío es "sin receta". */
export function enlaceDeRecetaNoVale(texto: string): boolean {
  return (texto ?? '').trim().length > 0 && !limpiarEnlaceDeReceta(texto);
}

/**
 * Comentario y receta de una foto a la vez, en una sola escritura.
 *
 * Mismas reglas que `conComentario`: vacío QUITA la clave, no la deja a '', y
 * la lista de entrada no se toca.
 */
export function conDetalle(
  fotos: readonly MealBookPhoto[],
  idDeLaFoto: string,
  detalle: { comentario: string; receta: string }
): MealBookPhoto[] {
  const comentario = limpiarComentario(detalle.comentario);
  const receta = limpiarEnlaceDeReceta(detalle.receta);
  return fotos.map((foto) => {
    if (foto.id !== idDeLaFoto) return foto;
    const { caption: _c, recipeUrl: _r, ...resto } = foto;
    return {
      ...resto,
      ...(comentario ? { caption: comentario } : {}),
      ...(receta ? { recipeUrl: receta } : {}),
    };
  });
}

/** Cuántas fotos llevan receta. Para el contador del coach. */
export function cuantasConReceta(fotos: readonly MealBookPhoto[]): number {
  return fotos.filter((f) => !!f.recipeUrl).length;
}
