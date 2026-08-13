/**
 * Cómo se llama la comunidad de un alumno.
 *
 * Decía "Comunidad UDECA", y eso es de quien hizo la app, no de quien la usa.
 * Un alumno no entrena con UDECA: entrena con Luis, con Marta o con quien le
 * cobre cada mes. El grupo del ranking son los alumnos de ESE entrenador, y
 * poner otra marca por delante es quitarle el sitio a la única persona con la
 * que tiene relación.
 *
 * Se usa el nombre de pila y no el completo: "Comunidad Luis Tena Fernández"
 * no cabe en un título de móvil y suena a organismo público.
 */

/** El rótulo genérico, para cuando aún no sabemos con quién entrena. */
export const COMUNIDAD_SIN_NOMBRE = 'Tu comunidad';

/** "Comunidad Luis". Sin nombre, algo que no sea la marca de la app. */
export function tituloDeComunidad(nombreDelEntrenador: string | undefined | null): string {
  const nombre = (nombreDelEntrenador ?? '').trim().split(/\s+/)[0] ?? '';
  return nombre ? `Comunidad ${nombre}` : COMUNIDAD_SIN_NOMBRE;
}
