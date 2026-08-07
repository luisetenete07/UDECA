/**
 * Fechas escritas como se escriben en español.
 *
 * `textTransform: 'capitalize'` pone mayúscula en CADA palabra, y en inglés eso
 * casi siempre acierta. En español no: deja "Agosto De 2026" y "Miércoles, 5 De
 * Agosto". Es un detalle diminuto y de los que más delatan a una app traducida
 * por encima, porque aparece en cada pantalla que enseña un día.
 *
 * En español solo va en mayúscula la primera letra de la frase: los meses y los
 * días de la semana son nombres comunes.
 */

/** Mayúscula solo en la primera letra; el resto se queda como está. */
export function mayusculaInicial(texto: string): string {
  if (!texto) return texto;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "agosto de 2026" -> "Agosto de 2026" */
export function mesLargo(ts: number | Date): string {
  const d = typeof ts === 'number' ? new Date(ts) : ts;
  return mayusculaInicial(d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }));
}

/** "miércoles, 5 de agosto" -> "Miércoles, 5 de agosto" */
export function diaLargo(ts: number | Date, conAno = false): string {
  const d = typeof ts === 'number' ? new Date(ts) : ts;
  return mayusculaInicial(
    d.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      ...(conAno ? { year: 'numeric' } : {}),
    })
  );
}

/** "05 ago 2026". La que se usa para fechas sueltas dentro de una ficha. */
export function fechaCorta(ts: number | Date): string {
  const d = typeof ts === 'number' ? new Date(ts) : ts;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * "5 ago". Sin año, para lo que pasa cerca: el principio y el final de un
 * bloque, un día del calendario, el rango de una semana. Estaba escrita igual
 * en cuatro sitios con tres nombres distintos (`fmt`, `fmtCorta`, `fmtCorta`).
 */
export function diaMes(ts: number | Date): string {
  const d = typeof ts === 'number' ? new Date(ts) : ts;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

/**
 * "5 ago 2026". Como `fechaCorta` pero sin el cero delante: para una fecha que
 * se lee, no para una columna de fechas que se comparan. En un selector queda
 * mejor "5 ago 2026" que "05 ago 2026".
 */
export function fechaLegible(ts: number | Date): string {
  const d = typeof ts === 'number' ? new Date(ts) : ts;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

/*
 * Comparar días, no instantes.
 *
 * Estas cuatro estaban copiadas por media app —`startOfDay` en la agenda y en
 * la lista de alumnos, `startOfDayLocal` en el entreno, `isToday` en nutrición,
 * `isSameDay` otra vez en el entreno— y todas hacen exactamente lo mismo. No
 * es solo repetición: el día es una cosa del CALENDARIO del usuario, y cada
 * copia era una oportunidad más de comparar milisegundos por error y hacer que
 * un entreno de las once de la noche cuente como el del día siguiente.
 *
 * Todas trabajan en hora local a propósito: el día del usuario es el suyo, no
 * el de UTC.
 */

/** Las 00:00 de ese día, en hora local. */
export function inicioDelDia(ts: number | Date): number {
  const d = typeof ts === 'number' ? new Date(ts) : new Date(ts.getTime());
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** ¿Caen los dos en el mismo día del calendario? */
export function esMismoDia(a: number | Date, b: number | Date = Date.now()): boolean {
  return inicioDelDia(a) === inicioDelDia(b);
}

/** ¿Es hoy? */
export function esHoy(ts: number | Date): boolean {
  return esMismoDia(ts, Date.now());
}

/**
 * El lunes de esa semana, a las 00:00.
 *
 * La semana empieza en lunes, que es como se cuenta aquí. `getDay()` devuelve
 * 0 para el domingo, así que el domingo hay que retroceder seis días y no uno:
 * es el fallo clásico de esta función y el motivo de que solo haya una.
 */
export function inicioDeLaSemana(ts: number | Date): number {
  const d = new Date(inicioDelDia(ts));
  const dia = d.getDay();
  d.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1));
  return d.getTime();
}
