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
