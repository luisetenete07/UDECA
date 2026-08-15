import { DIAS_ATRAS } from './registroTardio';
import { MAX_MARCA, MAX_PESO, type DictadoBruto, type EjercicioDelCatalogo } from './dictado';

/**
 * Entender un entreno dictado, aquí, sin servidor y sin IA.
 *
 * POR QUÉ NO HACE FALTA UN MODELO PARA ESTO
 *
 * Un entreno contado en voz alta no es texto libre: es una lista.
 *
 *   "cuatro series de dominadas: ocho, siete, seis y cinco.
 *    fondos con diez kilos, tres de ocho. duró unos cuarenta minutos"
 *
 * Hay un nombre de ejercicio, unos números detrás y a veces un peso. Y lo
 * mejor: los nombres NO hay que adivinarlos, porque ya tenemos la lista exacta
 * de los ejercicios de esa persona. Con eso, reconocerlo son reglas.
 *
 * Frente a mandarlo a un modelo, esto no cuesta dinero, funciona sin cobertura
 * —justo lo que pasa en medio gimnasio— y contesta al instante en vez de en
 * dos segundos. A cambio es más literal: si alguien cuenta su entreno como
 * quien escribe una novela, entenderá menos. Por eso lo que saca se le enseña
 * SIEMPRE antes de guardar (ver `resumenDelDictado`), y ahí se corrige.
 *
 * DEVUELVE LO MISMO QUE DEVOLVÍA EL SERVIDOR
 *
 * Un `DictadoBruto`, que sigue pasando por `limpiaDictado`. Ni la pantalla ni
 * el guardado se enteran de quién lo entendió, y desconfiar de lo que sale de
 * aquí es igual de barato que desconfiar de un modelo. Que un fallo mío no
 * pueda guardar un ejercicio inventado no es casualidad: es la misma red.
 *
 * ANTE LA DUDA, NO INVENTA
 *
 * Lo que no encaja se devuelve en `sinIdentificar` y se le enseña a la
 * persona. Apuntar de menos se arregla en diez segundos; apuntar una serie que
 * nadie hizo ensucia el histórico y las marcas, y eso ya no se ve venir.
 */

/** Los números escritos con letras, que es como se dictan. */
const PALABRAS: Record<string, number> = {
  cero: 0, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23,
  veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27,
  veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50,
  sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100,
  // La app también está en inglés, y quien la use en inglés dictará en inglés.
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};

/** Sin acentos, sin mayúsculas y sin espacios de más: así se compara. */
export function normaliza(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s.,:;+·-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * "treinta y cinco" → "35", "cuatro" → "4".
 *
 * Se hace antes que nada para que el resto del trabajo sea solo con cifras. El
 * "y" de "treinta y cinco" se resuelve aquí: en el resto del texto ese "y" es
 * una coma ("ocho, siete y seis") y no debe unir nada.
 */
export function aNumeros(texto: string): string {
  const palabras = texto.split(' ');
  const salida: string[] = [];
  /**
   * La palabra sin la puntuación pegada.
   *
   * Al dictar sale "ocho, siete, seis y cinco", y partiendo por espacios los
   * trozos son "ocho," y "cinco." — con la coma dentro. Sin quitarla, la mitad
   * de los números de una lista no se reconocen y se pierden series.
   */
  const nucleo = (p: string) => p.replace(/^[.,:;]+|[.,:;]+$/g, '');
  const cola = (p: string) => p.slice(nucleo(p).length + (p.length - p.replace(/^[.,:;]+/, '').length));
  for (let i = 0; i < palabras.length; i++) {
    const n = PALABRAS[nucleo(palabras[i])];
    if (n === undefined) {
      salida.push(palabras[i]);
      continue;
    }
    const detras = cola(palabras[i]);
    // Decena + "y" + unidad: treinta y cinco, cuarenta y dos.
    const dec = n >= 30 && n <= 90 && n % 10 === 0;
    if (dec && nucleo(palabras[i + 1] ?? '') === 'y') {
      const u = PALABRAS[nucleo(palabras[i + 2] ?? '')];
      if (u !== undefined && u >= 1 && u <= 9) {
        salida.push(String(n + u) + cola(palabras[i + 2]));
        i += 2;
        continue;
      }
    }
    salida.push(String(n) + detras);
  }
  return salida.join(' ');
}

/** Dónde aparece cada ejercicio del catálogo dentro de lo dictado. */
interface Mencion {
  ficha: EjercicioDelCatalogo;
  desde: number;
  hasta: number;
}

/**
 * Busca los ejercicios de ESA persona dentro del texto.
 *
 * Gana el nombre más largo que encaje en cada sitio: si alguien tiene "Front
 * lever" y "Front lever press", decir "front lever press" tiene que dar el
 * segundo. Ordenar por longitud y quedarse con el primero que no pise a otro
 * ya encontrado hace justo eso.
 */
export function mencionesDeEjercicios(
  texto: string,
  catalogo: EjercicioDelCatalogo[]
): Mencion[] {
  const encontradas: Mencion[] = [];
  const porLongitud = [...catalogo].sort(
    (a, b) => normaliza(b.nombre).length - normaliza(a.nombre).length
  );
  for (const ficha of porLongitud) {
    const nombre = normaliza(ficha.nombre);
    if (nombre.length < 3) continue;
    let desde = texto.indexOf(nombre);
    while (desde !== -1) {
      const hasta = desde + nombre.length;
      // Ni a medias de otra palabra ni encima de un ejercicio ya reconocido.
      const limpioIzq = desde === 0 || /[\s.,:;]/.test(texto[desde - 1]);
      const limpioDer = hasta >= texto.length || /[\s.,:;]/.test(texto[hasta]);
      const pisa = encontradas.some((m) => desde < m.hasta && hasta > m.desde);
      if (limpioIzq && limpioDer && !pisa) {
        encontradas.push({ ficha, desde, hasta });
        break;
      }
      desde = texto.indexOf(nombre, desde + 1);
    }
  }
  return encontradas.sort((a, b) => a.desde - b.desde);
}

/** Los kilos que se dicen de un ejercicio: "con 10 kilos", "10 kg", "+10". */
function pesoDe(trozo: string): { peso?: number; resto: string } {
  const m = /(?:con\s+|\+|with\s+)?(\d+(?:[.,]\d+)?)\s*(?:kg|kilos?|kilogramos?)\b/.exec(trozo);
  if (!m) return { resto: trozo };
  const n = Number.parseFloat(m[1].replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0 || n > MAX_PESO) return { resto: trozo };
  return { peso: n, resto: trozo.slice(0, m.index) + ' ' + trozo.slice(m.index + m[0].length) };
}

/** Un número que sirva como marca (repeticiones o segundos). */
const marcaValida = (n: number) => Number.isFinite(n) && n >= 1 && n <= MAX_MARCA;

/**
 * Las series que se cuentan en un trozo de texto.
 *
 * Dos formas, y hay que distinguirlas o se apunta cualquier cosa:
 *
 *  - LA LISTA: "ocho, siete, seis y cinco" → cuatro series, una por número.
 *  - EL MULTIPLICADOR: "3 de 8", "3x8", "cuatro series de diez" → tres o
 *    cuatro series iguales.
 *
 * El multiplicador se mira primero porque "3 de 8" leído como lista serían dos
 * series (una de 3 y otra de 8), que es justo lo contrario de lo que se dijo.
 */
export function seriesDe(trozo: string): number[] {
  const mult =
    /(\d+)\s*(?:series?\s+de|sets?\s+of|x|por|de)\s*(\d+)/.exec(trozo) ??
    /(\d+)\s*[x×]\s*(\d+)/.exec(trozo);
  if (mult) {
    const cuantas = Number.parseInt(mult[1], 10);
    const marca = Number.parseInt(mult[2], 10);
    if (cuantas >= 1 && cuantas <= 20 && marcaValida(marca)) {
      return Array.from({ length: cuantas }, () => marca);
    }
  }
  const sueltos = [...trozo.matchAll(/\b(\d+)\b/g)]
    .map((m) => Number.parseInt(m[1], 10))
    .filter(marcaValida);
  return sueltos;
}

/** Cuánto duró, si se dijo. */
export function duracionDe(texto: string): number | undefined {
  const m = /(\d+)\s*(?:min|mins|minutos?|minutes?)\b/.exec(texto);
  if (!m) return undefined;
  const n = Number.parseInt(m[1], 10);
  return n >= 1 && n <= 12 * 60 ? n : undefined;
}

/** De qué día habla: hoy, ayer, anteayer o "hace N días". */
export function haceDiasDe(texto: string): number | undefined {
  if (/\banteayer\b|\bantes de ayer\b/.test(texto)) return 2;
  if (/\bayer\b|\byesterday\b/.test(texto)) return 1;
  if (/\bhoy\b|\btoday\b/.test(texto)) return 0;
  const m = /\bhace\s+(\d+)\s*dias?\b|\b(\d+)\s*days?\s+ago\b/.exec(texto);
  if (!m) return undefined;
  const n = Number.parseInt(m[1] ?? m[2], 10);
  return n >= 0 && n < DIAS_ATRAS ? n : undefined;
}

/**
 * Lo que sonaba a ejercicio y no se reconoció.
 *
 * Se le enseña para que lo añada a mano si hace falta. No se adivina nada: si
 * dijo un ejercicio que no está en su plan ni en su biblioteca, no hay ningún
 * id al que colgarle las series, y apuntárselas a otro ejercicio parecido
 * sería peor que no apuntarlas.
 */
function loQueSobra(texto: string, menciones: Mencion[]): string[] {
  let resto = texto;
  // Se tapan los ejercicios reconocidos, de atrás hacia delante para no mover
  // las posiciones de los que quedan.
  for (const m of [...menciones].reverse()) {
    resto = resto.slice(0, m.desde) + ' '.repeat(m.hasta - m.desde) + resto.slice(m.hasta);
  }
  const RELLENO = new Set([
    'y', 'de', 'con', 'series', 'serie', 'sets', 'set', 'repeticiones', 'reps',
    'rep', 'kilos', 'kilo', 'kg', 'segundos', 'segundo', 'minutos', 'minuto',
    'min', 'duro', 'duracion', 'hoy', 'ayer', 'anteayer', 'hace', 'dias', 'dia',
    'unos', 'unas', 'un', 'una', 'el', 'la', 'los', 'las', 'a', 'en', 'por',
    'hice', 'he', 'hecho', 'x', 'of', 'with', 'and', 'the', 'did', 'i', 'was',
    'about', 'for', 'to', 'ago', 'today', 'yesterday', 'days', 'day', 'it',
    'took', 'minutes', 'seconds', 'lastre', 'lastrado', 'goma', 'total',
  ]);
  return resto
    .split(/[.,;:]/)
    .map((frase) =>
      frase
        .split(' ')
        .filter((p) => p && !RELLENO.has(p) && !/^\d+$/.test(p))
        .join(' ')
        .trim()
    )
    .filter((f) => f.length >= 3)
    .slice(0, 8);
}

/**
 * Reparte un trozo entre el ejercicio de antes y el de después.
 *
 * "dominadas 8, 7, 6. cuatro series de diez flexiones": los números de en
 * medio no son todos de las dominadas. Un "N series de M" pegado al final del
 * trozo describe al ejercicio que viene DETRÁS, no al que quedó atrás — es
 * como se habla: el número de series se dice antes de nombrar el ejercicio.
 *
 * Solo se corta ahí: cualquier otro número se queda con el de antes, que es lo
 * que pasa en "dominadas 8, 7, 6 y 5".
 */
function repartePorDelante(trozo: string): { suyo: string; delSiguiente: string } {
  const m = /(\d+)\s*(?:series?\s+de|sets?\s+of)\s*(\d+)\s*[a-z]*\s*$/.exec(trozo);
  if (!m) return { suyo: trozo, delSiguiente: '' };
  return { suyo: trozo.slice(0, m.index), delSiguiente: m[0] };
}

/**
 * Lo dictado, entendido.
 *
 * El texto se parte por los ejercicios que se han reconocido: los números que
 * van DETRÁS de un nombre son sus series, hasta que aparece el siguiente
 * nombre. Es como se cuenta un entreno en voz alta, y es lo que permite que
 * "dominadas 8,7,6 fondos 3 de 10" salga bien sin preguntarle nada a nadie.
 */
export function entiendeDictado(
  texto: string,
  catalogo: EjercicioDelCatalogo[]
): DictadoBruto {
  const limpio = aNumeros(normaliza(texto));
  const menciones = mencionesDeEjercicios(limpio, catalogo);

  // La duración y el día se quitan del texto antes de repartir números: si no,
  // "duró 40 minutos" se apuntaría como una serie de 40 del último ejercicio.
  const duracionMin = duracionDe(limpio);
  const haceDias = haceDiasDe(limpio);
  // Se tapan CON ESPACIOS, no se recortan: las posiciones de los ejercicios
  // están calculadas sobre `limpio`, y acortar el texto las descolocaría
  // todas. (Pasó: las series se le colgaban al ejercicio equivocado.)
  const tapa = (t: string, re: RegExp) => t.replace(re, (m) => ' '.repeat(m.length));
  const sinTiempos = [
    /(\d+)\s*(?:min|mins|minutos?|minutes?)\b/g,
    /\bhace\s+\d+\s*dias?\b/g,
    /\b\d+\s*days?\s+ago\b/g,
  ].reduce(tapa, limpio);

  const ejercicios: NonNullable<DictadoBruto['ejercicios']> = [];
  // "Cuatro series de diez flexiones": el número va DELANTE del nombre, así que
  // lo que hay antes del primer ejercicio también cuenta.
  let pendiente =
    menciones.length > 0 ? repartePorDelante(sinTiempos.slice(0, menciones[0].desde)).delSiguiente : '';
  for (let i = 0; i < menciones.length; i++) {
    const m = menciones[i];
    const fin = i + 1 < menciones.length ? menciones[i + 1].desde : sinTiempos.length;
    const { suyo, delSiguiente } = repartePorDelante(sinTiempos.slice(m.hasta, fin));
    // Lo que se dijo ANTES del nombre y era para él: "cuatro series de diez
    // flexiones". Se lo pasa el ejercicio anterior al repartir su trozo.
    const trozo = (pendiente ? pendiente + ' ' : '') + suyo;
    pendiente = delSiguiente;
    const { peso, resto } = pesoDe(trozo);
    const marcas = seriesDe(resto);
    if (marcas.length === 0) continue;
    ejercicios.push({
      exerciseId: m.ficha.id,
      series: marcas.map((marca) => ({
        marca,
        // El peso dicho vale para todas las series de ese ejercicio: quien
        // dice "fondos con 10 kilos, 3 de 8" no repite los kilos tres veces.
        peso: m.ficha.carga === 'none' ? undefined : peso,
      })),
    });
  }

  return {
    ejercicios,
    duracionMin,
    haceDias,
    sinIdentificar: loQueSobra(limpio, menciones),
  };
}
