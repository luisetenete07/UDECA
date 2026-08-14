import { getIdioma } from './idioma';

/**
 * Fechas escritas como se escriben en el idioma de quien las lee.
 *
 * El idioma se pregunta AQUÍ, en cada llamada, y no se le pasa por parámetro a
 * las veinte funciones de este fichero. Es a propósito: hay ciento y pico
 * sitios que llaman a estas funciones, y si el idioma fuera un argumento
 * bastaría con que a uno se le olvidara para que esa pantalla se quedara en
 * español para siempre sin que nadie lo notara. Preguntándolo aquí, no hay
 * forma de olvidarse.
 *
 * `textTransform: 'capitalize'` pone mayúscula en CADA palabra, y en inglés eso
 * casi siempre acierta. En español no: deja "Agosto De 2026" y "Miércoles, 5 De
 * Agosto". Es un detalle diminuto y de los que más delatan a una app traducida
 * por encima, porque aparece en cada pantalla que enseña un día.
 *
 * En español solo va en mayúscula la primera letra de la frase: los meses y los
 * días de la semana son nombres comunes.
 */

/**
 * El locale que toca. En inglés, el británico: la app es europea y "13/08" se
 * lee como el 13 de agosto, no como un mes 13 que no existe.
 */
export function localeActual(): string {
  return getIdioma() === 'en' ? 'en-GB' : 'es-ES';
}

/**
 * Mayúscula solo en la primera letra; el resto se queda como está.
 *
 * En inglés los meses y los días ya vienen en mayúscula del propio sistema, así
 * que esto no les hace nada. En español sí hace falta: son nombres comunes y
 * `toLocaleDateString` los devuelve en minúscula.
 */
export function mayusculaInicial(texto: string): string {
  if (!texto) return texto;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "agosto de 2026" -> "Agosto de 2026" */
export function mesLargo(ts: number | Date): string {
  const d = typeof ts === 'number' ? new Date(ts) : ts;
  return mayusculaInicial(d.toLocaleDateString(localeActual(), { month: 'long', year: 'numeric' }));
}

/** "miércoles, 5 de agosto" -> "Miércoles, 5 de agosto" */
export function diaLargo(ts: number | Date, conAno = false): string {
  const d = typeof ts === 'number' ? new Date(ts) : ts;
  return mayusculaInicial(
    d.toLocaleDateString(localeActual(), {
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
  return d.toLocaleDateString(localeActual(), { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * "5 ago". Sin año, para lo que pasa cerca: el principio y el final de un
 * bloque, un día del calendario, el rango de una semana. Estaba escrita igual
 * en cuatro sitios con tres nombres distintos (`fmt`, `fmtCorta`, `fmtCorta`).
 */
export function diaMes(ts: number | Date): string {
  const d = typeof ts === 'number' ? new Date(ts) : ts;
  return d.toLocaleDateString(localeActual(), { day: 'numeric', month: 'short' });
}

/**
 * "5 ago 2026". Como `fechaCorta` pero sin el cero delante: para una fecha que
 * se lee, no para una columna de fechas que se comparan. En un selector queda
 * mejor "5 ago 2026" que "05 ago 2026".
 */
export function fechaLegible(ts: number | Date): string {
  const d = typeof ts === 'number' ? new Date(ts) : ts;
  return d.toLocaleDateString(localeActual(), { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * "5/8/2026". La fecha suelta de una fila de lista, donde lo que importa es
 * ocupar poco y poder comparar dos líneas de un vistazo.
 */
export function fechaNumerica(ts: number | Date): string {
  const d = typeof ts === 'number' ? new Date(ts) : ts;
  return d.toLocaleDateString(localeActual());
}

/** "5 de agosto". El día dicho como se dice en voz alta, sin año ni semana. */
export function diaYMes(ts: number | Date): string {
  const d = typeof ts === 'number' ? new Date(ts) : ts;
  return d.toLocaleDateString(localeActual(), { day: 'numeric', month: 'long' });
}

/** "ago". Para los ejes de las gráficas, donde solo cabe el mes. */
export function mesCorto(ts: number | Date): string {
  const d = typeof ts === 'number' ? new Date(ts) : ts;
  return d.toLocaleDateString(localeActual(), { month: 'short' });
}

/** "agosto", el mes a secas. Para meterlo en una frase que ya trae el día. */
export function nombreDelMes(ts: number | Date): string {
  const d = typeof ts === 'number' ? new Date(ts) : ts;
  return d.toLocaleDateString(localeActual(), { month: 'long' });
}

/**
 * "Sáb, 9 ago". La fecha de una sesión en una lista de sesiones.
 *
 * Lleva el día de la semana porque en un historial de entrenos eso es lo que
 * se busca —"¿el de los sábados?"— y el número solo no lo dice.
 */
export function diaSemanaCorto(ts: number | Date): string {
  const d = typeof ts === 'number' ? new Date(ts) : ts;
  return mayusculaInicial(
    d.toLocaleDateString(localeActual(), { weekday: 'short', day: 'numeric', month: 'short' })
  );
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

/** El día 1 de ese mes, a las 00:00. Para lo que se cuenta por meses naturales. */
export function inicioDelMes(ts: number | Date): number {
  const d = new Date(inicioDelDia(ts));
  d.setDate(1);
  return d.getTime();
}

/**
 * `n` días después (o antes, con `n` negativo), a las 00:00.
 *
 * Se suma con `setDate` y no sumando milisegundos a propósito: los días que
 * cambia la hora duran 23 o 25 horas, y "dentro de una semana" sumando
 * 7×86400000 cae una hora antes o después y puede saltarse el día.
 */
export function masDias(ts: number | Date, n: number): number {
  const d = new Date(inicioDelDia(ts));
  d.setDate(d.getDate() + n);
  return d.getTime();
}

/**
 * Las 12:00 de ese día, en hora local.
 *
 * Es la hora que se le pone a un entreno registrado más tarde, cuando no se
 * sabe a qué hora fue. Las 00:00 no valen: cualquier resta de un rato o un
 * desfase de zona horaria lo empujaría al día anterior, y el entreno saldría
 * en el día equivocado del histórico. El mediodía deja doce horas de margen a
 * cada lado.
 */
export function mediodiaDe(ts: number | Date): number {
  const d = new Date(inicioDelDia(ts));
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}

/**
 * Días de calendario entre dos fechas (b − a).
 *
 * El redondeo absorbe el desfase de ±1 h de los cambios de hora: sin él, la
 * semana del cambio de hora mide 6,96 días, se trunca a 6 y el ciclo de días
 * sueltos se desplaza un día para todo el que entrene en primavera.
 */
export function diasEntre(a: number | Date, b: number | Date): number {
  return Math.round((inicioDelDia(b) - inicioDelDia(a)) / (24 * 60 * 60 * 1000));
}
