/**
 * Mayúscula en la primera letra, y solo en la primera.
 *
 * Existe porque `textTransform: 'capitalize'` no hace esto: ataca a TODAS las
 * palabras. En español, donde los meses y los días van en minúscula y las
 * fechas llevan preposición, el resultado es "Martes, 4 De Agosto" o "Agosto De
 * 2026" — la mayúscula intrusa en el "de" delata el atajo.
 *
 * Lo que hace falta al abrir frase con una fecha es subir una sola letra, y eso
 * no lo sabe hacer el CSS. Estaba resuelto a mano en tres pantallas, cada una a
 * su manera; aquí está una vez.
 */
export const capitalizar = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
