/**
 * El descanso entre series, escrito y leído en un solo sitio.
 *
 * Estaba copiado tres veces —el editor de rutinas del coach, el plan propio
 * del atleta y la pantalla de entreno—, y las tres copias no eran iguales: una
 * aceptaba "mm:ss" con segundos sueltos y otra no, una devolvía "" para el cero
 * y otra "0:00". Eso significa que el mismo "1,5" escrito por el coach y por el
 * atleta podía acabar en dos descansos distintos, que es justo el tipo de fallo
 * que nadie reporta porque nadie lo ve: solo entrena peor.
 *
 * El descanso se escribe en MINUTOS porque es como se piensa ("descansa dos
 * minutos"), y se enseña en mm:ss porque es como se cuenta cuando ya estás
 * mirando el reloj.
 */

/**
 * Texto → segundos. Admite minutos con decimales ("1.5" o "1,5" = 1 min 30 s)
 * y también "mm:ss" por si se escribe así. Lo que no se entienda vale 0: en un
 * campo de texto libre siempre entra algo raro, y un descanso de cero se ve al
 * instante, mientras que un NaN rompe la pantalla entera.
 */
export function segundosDeTexto(valor: string): number {
  const t = valor.trim().replace(',', '.');
  if (!t) return 0;
  if (t.includes(':')) {
    const [m, s] = t.split(':');
    return (parseInt(m, 10) || 0) * 60 + (parseInt(s, 10) || 0);
  }
  const minutos = parseFloat(t);
  if (Number.isNaN(minutos) || minutos < 0) return 0;
  return Math.round(minutos * 60);
}

/**
 * Segundos → "3:30".
 *
 * `vacioSiCero` distingue los dos usos reales: en un CAMPO de texto, un cero se
 * enseña vacío (nadie ha escrito nada todavía); en una ETIQUETA que dice
 * "Descanso 0:00", el cero es un dato y hay que verlo.
 */
export function minutosSegundos(segundos?: number, vacioSiCero = true): string {
  if (!segundos) return vacioSiCero ? '' : '0:00';
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
