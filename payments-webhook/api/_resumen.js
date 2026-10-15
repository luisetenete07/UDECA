/**
 * EL RESUMEN DEL DOMINGO.
 *
 * Una notificación a la semana con lo que el alumno ha hecho: entrenos,
 * series y pasos. Es lo único que el alumno recibe sin haber hecho nada para
 * pedirlo y que no le recuerda lo que NO ha hecho: engancha por lo positivo.
 *
 * Solo a quien ha entrenado al menos una vez esa semana. A quien no ha
 * entrenado ya le llega el aviso de inactividad; un "0 entrenos" un domingo
 * no anima a nadie.
 */

/** "52.300": los miles con punto, como se escriben en español. */
function conMiles(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * El texto de la notificación, o null si no toca mandarla.
 * @param {{ entrenos: number, series: number, pasos: number, racha: number }} semana
 */
export function resumenDeLaSemana({ entrenos, series, pasos, racha }) {
  if (!entrenos || entrenos < 1) return null;
  const partes = [entrenos === 1 ? '1 entreno' : `${entrenos} entrenos`];
  if (series > 0) partes.push(series === 1 ? '1 serie' : `${conMiles(series)} series`);
  if (pasos > 0) partes.push(`${conMiles(pasos)} pasos`);
  const lista =
    partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
  const cierre = racha >= 3 ? ` Llevas una racha de ${racha} días.` : ' La semana que viene, a por más.';
  return { title: 'Tu semana', body: `${lista} esta semana.${cierre}` };
}

/** Series completadas de un entrenamiento guardado. */
export function seriesHechas(log) {
  return (log?.exercises ?? []).reduce(
    (n, ex) => n + (ex?.sets ?? []).filter((s) => s?.completed).length,
    0
  );
}
