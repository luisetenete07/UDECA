/**
 * La marca que se lee en la app: UDECA, o la que haya puesto quien paga.
 *
 * Un entrenador que vive de esto no está vendiendo UDECA: está vendiendo LO
 * SUYO. Que sus alumnos abran la app y lean el nombre de otra empresa le resta
 * a él y no le suma a nadie. Con esto, el coach escribe su palabra y es la que
 * ven él y todos sus alumnos.
 *
 * QUIÉN VE QUÉ
 *
 *  - Entrenador y atleta: la suya, porque la han puesto ellos.
 *  - Alumno de un entrenador: LA DE SU ENTRENADOR. No tiene marca propia —no
 *    paga y no vende nada— y la app es, para él, la de su coach.
 *  - Sin sesión (entrar, registrarse): UDECA. Ahí todavía no se sabe de quién
 *    es nadie, y la marca de la app es la única que hay.
 *
 * Aquí no se importa nada a propósito: es recorte de texto y elegir entre dos
 * cadenas, y así el guardián lo ejecuta de verdad en vez de leer el fichero.
 */

/** Lo que se lee cuando nadie ha puesto nada. */
export const MARCA_POR_DEFECTO = 'UDECA';

/**
 * Cuántas letras caben. DOCE, y el número sale de medir, no de opinar.
 *
 * La marca se pinta en tres sitios y el más estrecho manda: la cabecera de la
 * barra lateral, donde comparte fila con el emblema y quedan unos 150 px para
 * el texto a 19 px con 2 de espaciado. Ahí entran doce letras anchas —las
 * mayúsculas son lo peor— sin empujar nada.
 *
 * El otro sitio delicado es el logo grande de las pantallas de puerta, a 30 px:
 * en un móvil de 320 px con sus márgenes quedan unos 280, y doce letras a ese
 * tamaño caben justas. Por eso, además del tope, los tres sitios llevan
 * `numberOfLines={1}`: el tope evita el caso normal y esa línea evita el raro
 * (una tipografía más ancha, un móvil más estrecho).
 *
 * Trece letras ya se salen. Si algún día se sube, hay que volver a medirlo en
 * la barra lateral, que es donde se rompe primero.
 */
export const LARGO_DE_LA_MARCA = 12;

/**
 * El texto tal y como se guarda.
 *
 * Se juntan los espacios repetidos, se quitan los saltos de línea —una marca es
 * una palabra, no un párrafo— y se corta al tope. El corte va DESPUÉS de
 * limpiar: al revés, los espacios sobrantes se comerían letras que sí caben.
 *
 * No se fuerza a mayúsculas aunque los tres sitios la pinten en grande: quien
 * escribe "Iron Box" quiere leer "Iron Box" al editarlo, y el estilo es cosa de
 * la pantalla, no del dato.
 */
export function limpiarMarca(texto: string): string {
  return texto
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LARGO_DE_LA_MARCA)
    .trim();
}

/** ¿Vale como marca? Vacío vale: significa volver a UDECA. */
export function marcaValida(texto: string): boolean {
  return limpiarMarca(texto).length <= LARGO_DE_LA_MARCA;
}

interface ConMarca {
  role?: string;
  brandName?: string;
}

/**
 * La marca que le toca a esta persona.
 *
 * `deSuEntrenador` es el perfil del coach, y solo se usa si quien mira es un
 * alumno. Si todavía no ha llegado —se carga aparte— se enseña UDECA, que es
 * mejor que un hueco parpadeando.
 */
export function marcaDe(
  perfil: ConMarca | null | undefined,
  deSuEntrenador?: ConMarca | null
): string {
  if (!perfil) return MARCA_POR_DEFECTO;
  const propia = limpiarMarca(perfil.brandName ?? '');
  if (perfil.role === 'client') {
    const delCoach = limpiarMarca(deSuEntrenador?.brandName ?? '');
    return delCoach || MARCA_POR_DEFECTO;
  }
  return propia || MARCA_POR_DEFECTO;
}

/** ¿Está usando una marca propia, o la de la casa? Para los textos de ayuda. */
export function tieneMarcaPropia(perfil: ConMarca | null | undefined): boolean {
  return limpiarMarca(perfil?.brandName ?? '').length > 0;
}
