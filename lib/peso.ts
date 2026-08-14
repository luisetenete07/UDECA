import { masDias } from './fechas';
import type { WeightLog } from './types';

/**
 * El peso, que es asunto de nutrición.
 *
 * Estaba en Progreso, en una pestaña propia entre los entrenos y los
 * ejercicios, y ahí no significaba nada: el peso no sube ni baja por lo que
 * levantas, sube y baja por lo que comes. Puesto al lado de las calorías, los
 * macros y los pasos, la cifra por fin se lee junto a lo que la explica.
 *
 * Aquí vive lo que hay que calcular para enseñarlo: cuánto pesa hoy, cuánto se
 * ha movido, y cuánto falta para donde quiere llegar. Son cuatro cuentas, pero
 * son las que alguien mira cada semana para decidir si lo está haciendo bien.
 */

const DIA_MS = 24 * 60 * 60 * 1000;

/** Cuánto tiempo atrás se mira para decir "esta semana" y "este mes". */
export const DIAS_SEMANA = 7;
export const DIAS_MES = 30;

export interface ResumenDePeso {
  /** El último registrado, o nada si nunca ha pesado. */
  actual?: number;
  /** Diferencia con el más cercano a hace una semana. */
  semana?: number;
  /** Lo mismo con el mes. */
  mes?: number;
  /** Kilos que faltan hasta el objetivo (negativo = hay que bajar). */
  aObjetivo?: number;
  /** ¿Ya está en su objetivo (con medio kilo de margen)? */
  enObjetivo: boolean;
}

/** Un peso escrito a mano, en número. Admite la coma, que es como se teclea. */
export function pesoDeTexto(texto: string): number | undefined {
  const n = Number(String(texto ?? '').replace(',', '.').trim());
  // Por debajo de 20 kg y por encima de 400 no es un peso: es un dedo torpe, y
  // un dato así deforma la gráfica de meses.
  if (!Number.isFinite(n) || n < 20 || n > 400) return undefined;
  return Math.round(n * 10) / 10;
}

/**
 * Con qué peso se compara para decir "esta semana" o "este mes".
 *
 * El candidato bueno es el último anterior al corte: marca dónde estaba
 * entonces. Si no hay ninguno —lleva menos tiempo apuntándose que la ventana—
 * vale el primero que haya dentro; si no, quien empezó hace tres días no vería
 * un número en un mes, y son justo los primeros días cuando más se mira.
 *
 * Pero no vale cualquier cosa vieja. Si el único peso anterior es de hace dos
 * meses, esta semana NO se sabe: enseñar esos cinco kilos como "esta semana"
 * es mentir, y es una mentira que cambia lo que alguien come mañana. De ahí el
 * margen: no se mira más atrás de una ventana entera antes del corte.
 *
 * `logs` llega ORDENADO de antiguo a reciente.
 */
function referencia(logs: WeightLog[], desde: number, margen: number): WeightLog | undefined {
  const limite = desde - margen;
  let previo: WeightLog | undefined;
  for (const l of logs) {
    if (l.date < limite) continue;
    if (l.date <= desde) {
      previo = l;
    } else {
      previo = previo ?? l;
      break;
    }
  }
  return previo;
}

/**
 * El resumen que se enseña arriba del bloque.
 *
 * Las variaciones se calculan contra el peso que había ENTONCES, no contra el
 * primero de la lista: alguien que lleva un año apuntándose no quiere saber
 * cuánto ha cambiado desde que empezó, quiere saber cómo va esta semana.
 */
export function resumenDePeso(
  logs: WeightLog[],
  objetivo?: number,
  ahora = Date.now()
): ResumenDePeso {
  const ordenados = [...logs].sort((a, b) => a.date - b.date);
  const ultimo = ordenados[ordenados.length - 1];
  if (!ultimo) return { enObjetivo: false };

  const actual = ultimo.weightKg;
  const hace = (dias: number) => {
    const previo = referencia(ordenados, masDias(ahora, -dias), dias * DIA_MS);
    // Con un solo peso no hay variación que contar. Decir "0 kg esta semana"
    // sería inventarse una semana entera a partir de un dato de hoy.
    return previo && previo.id !== ultimo.id
      ? Math.round((actual - previo.weightKg) * 10) / 10
      : undefined;
  };

  const aObjetivo =
    objetivo && objetivo > 0 ? Math.round((objetivo - actual) * 10) / 10 : undefined;

  return {
    actual,
    semana: hace(DIAS_SEMANA),
    mes: hace(DIAS_MES),
    aObjetivo,
    // Medio kilo de margen: el peso baila eso entre la mañana y la noche, y
    // decirle a alguien que le faltan 200 gramos es decirle nada.
    enObjetivo: aObjetivo !== undefined && Math.abs(aObjetivo) <= 0.5,
  };
}

/**
 * Un peso escrito como se escribe en español: con coma.
 *
 * A mano y no con `toLocaleString('es-ES')`: eso depende del ICU del motor, y
 * en un Node o un Android recortados devuelve el punto. Un peso con punto en
 * una app en español canta, y peor: no cuadra con el de la pantalla de al lado.
 */
export function kgCorto(kg: number): string {
  return String(Math.round(kg * 10) / 10).replace('.', ',');
}

/** Una variación con su signo, para pintarla ("+0,4 kg", "-1,2 kg"). */
export function conSigno(kg: number): string {
  const t = Math.abs(kg).toFixed(1).replace('.', ',');
  if (kg > 0) return `+${t} kg`;
  if (kg < 0) return `-${t} kg`;
  return `${t} kg`;
}

/**
 * Lo que se le dice sobre su objetivo.
 *
 * Sin objetivo no se le regaña ni se le empuja a ponerse uno: hay quien apunta
 * el peso para vigilarlo, no para cambiarlo.
 */
export function textoDelObjetivo(r: ResumenDePeso, objetivo?: number): string | null {
  if (!objetivo || r.actual === undefined || r.aObjetivo === undefined) return null;
  if (r.enObjetivo) return `Estás en tu objetivo de ${objetivo} kg.`;
  const cuantos = Math.abs(r.aObjetivo).toFixed(1).replace('.', ',');
  // Se dice el VERBO, no solo el número. "Te faltan 3,4 kg" pesando 68 con
  // objetivo 64 se lee, a la velocidad a la que se lee esto, como que hay que
  // ganarlos: es la frase que uno espera cuando está intentando subir. Decir
  // "perder" o "ganar" quita esa duda sin gastar una línea más.
  return r.aObjetivo < 0
    ? `Te faltan perder ${cuantos} kg para tu objetivo de ${objetivo} kg.`
    : `Te faltan ganar ${cuantos} kg para tu objetivo de ${objetivo} kg.`;
}
