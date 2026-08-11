/**
 * Juntar trozos de texto sin dejar separadores huérfanos.
 *
 * Es un detalle diminuto que se ve en cuanto falta un dato: la tarjeta de hoy
 * ponía "Días sueltos ·  · Int. 7/10" en cuanto el ciclo no tenía etiqueta, y
 * el resumen de una sesión terminaba en "Bloque de fuerza · " cuando no había
 * día. Un punto suelto colgando no dice "falta un dato", dice "esta app está a
 * medio hacer", y aparece justo en las pantallas que más se miran.
 *
 * El patrón bueno ya estaba escrito en media app —`.filter(Boolean).join(' · ')`—
 * y los dos sitios rotos eran precisamente los que lo hacían con una plantilla.
 * Con una función es difícil escribirlo mal.
 */

/** El separador de la app: punto medio con espacios, no guiones ni barras. */
export const SEPARADOR = ' · ';

/**
 * Une lo que haya, se salta lo que no.
 *
 * Acepta `null`, `undefined`, cadenas vacías y espacios en blanco, que son las
 * cuatro formas en que un dato puede no estar.
 */
export function unido(...partes: (string | number | null | undefined | false)[]): string {
  return partes
    .filter((p): p is string | number => p !== null && p !== undefined && p !== false)
    .map((p) => String(p).trim())
    .filter((p) => p.length > 0)
    .join(SEPARADOR);
}

/**
 * Un número con el punto de los miles, como se escribe en español.
 *
 * Escrito a mano y no con `toLocaleString` porque esa función depende de los
 * datos de idioma que traiga el motor: en un Android con ICU recortado
 * devuelve "8000" y en un iPhone "8.000", y la misma pantalla se ve distinta
 * según el móvil. Aquí, ocho mil son 8.000 en todas partes.
 */
export function conMiles(n: number): string {
  const negativo = n < 0;
  const entero = Math.abs(Math.round(n)).toString();
  let salida = '';
  for (let i = 0; i < entero.length; i++) {
    if (i > 0 && (entero.length - i) % 3 === 0) salida += '.';
    salida += entero[i];
  }
  return negativo ? `-${salida}` : salida;
}
