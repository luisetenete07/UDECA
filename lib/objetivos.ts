import type { UserProfile } from './types';

/**
 * Los tres objetivos de quien entrena: corto, medio y largo plazo.
 *
 * Antes había uno solo, una línea de texto libre. El problema no era el
 * tamaño: era que en esa línea cabían dos cosas que no se parecen en nada
 * —"mi primera dominada" y "estar fuerte a los 50"— y quien las escribe junta
 * la de dentro de un mes con la de dentro de tres años y acaba sin ninguna de
 * las dos. Separarlas por plazo es lo que hace que sirvan: el de corto plazo
 * se mira esta semana, el de largo recuerda para qué.
 *
 * Cada uno es UNA línea, y eso se hace cumplir aquí (`limpiaObjetivo`): un
 * párrafo en el sitio de un titular deja de leerse a los tres días.
 *
 * LO QUE NO SE PUEDE PERDER son los objetivos que ya estaban escritos en el
 * campo antiguo. Por eso `objetivosDe` lo lee y lo coloca en el de corto plazo
 * mientras no haya nada nuevo: nadie abre la app y se encuentra su objetivo
 * borrado.
 */

/** Cuánto cabe en una línea. Más que esto ya no se lee de un vistazo. */
export const MAX_OBJETIVO = 90;

export type Plazo = 'corto' | 'medio' | 'largo';

export interface Objetivos {
  corto: string;
  medio: string;
  largo: string;
}

/**
 * CADA PLAZO, CON SU GRADO DE REALISMO. Lo marcó Luis:
 *
 *  - Corto plazo: REALISMO MÁXIMO. Lo que vas a conseguir sí o sí con lo que
 *    ya haces. Si no es seguro, no es de corto plazo.
 *  - Medio plazo: DIFÍCIL, pero alcanzable en 6 meses.
 *  - Largo plazo: CASI IMPOSIBLE. El sueño; lo que te hace levantarte a
 *    entrenar.
 *
 * `realismo` va de 3 (máximo) a 1 (casi imposible) y se pinta como tres
 * barras, como la cobertura del móvil, con "Realista 3/3", "2/3" o "1/3" al
 * lado: así lo quiso Luis, un número que se lee de un vistazo en vez de una
 * frase en cada plazo.
 */
export interface PlazoDeObjetivo {
  clave: Plazo;
  etiqueta: string;
  ejemplo: string;
  /** El icono (Ionicons) de cada plazo. */
  icono: 'flag' | 'trending-up' | 'rocket';
  /** 3 = realismo máximo, 2 = difícil pero alcanzable, 1 = casi imposible. */
  realismo: 1 | 2 | 3;
  /** Cómo de realista tiene que ser: "Realista 3/3", "2/3" o "1/3". */
  comoDeRealista: string;
  /** Lo que se le dice a quien lo escribe. */
  pista: string;
}

export const PLAZOS: PlazoDeObjetivo[] = [
  {
    clave: 'corto',
    etiqueta: 'Corto plazo',
    ejemplo: 'Ej. 5 dominadas seguidas',
    icono: 'flag',
    realismo: 3,
    comoDeRealista: 'Realista 3/3',
    pista: 'Lo que vas a conseguir sí o sí con lo que ya haces.',
  },
  {
    clave: 'medio',
    etiqueta: 'Medio plazo',
    ejemplo: 'Ej. Mi primera muscle up',
    icono: 'trending-up',
    realismo: 2,
    comoDeRealista: 'Realista 2/3',
    pista: 'Te va a costar, pero en seis meses es tuyo.',
  },
  {
    clave: 'largo',
    etiqueta: 'Largo plazo',
    ejemplo: 'Ej. Plancha completa',
    icono: 'rocket',
    realismo: 1,
    comoDeRealista: 'Realista 1/3',
    pista: 'El sueño. Lo que te hace levantarte a entrenar.',
  },
];

/**
 * Una línea de verdad: sin saltos, sin espacios de más y sin pasarse de largo.
 *
 * Los saltos de línea llegan solos al pegar texto desde otro sitio, y un campo
 * que dice "una línea" pero acepta cinco es un campo que miente.
 */
export function limpiaObjetivo(texto: string | undefined | null): string {
  return (texto ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_OBJETIVO);
}

/** Los tres, ya limpios, con el objetivo antiguo rescatado si hace falta. */
export function objetivosDe(profile: UserProfile | null | undefined): Objetivos {
  const corto = limpiaObjetivo(profile?.goalShort);
  const medio = limpiaObjetivo(profile?.goalMid);
  const largo = limpiaObjetivo(profile?.goalLong);
  // El campo viejo solo entra cuando no hay NADA nuevo. Si ya escribió el de
  // medio plazo, meterle además el antiguo en el de corto sería resucitar algo
  // que él dio por sustituido.
  if (!corto && !medio && !largo) return { corto: limpiaObjetivo(profile?.goal), medio: '', largo: '' };
  return { corto, medio, largo };
}

/** ¿Hay algo que enseñar? Sin esto se pinta una tarjeta vacía. */
export function hayObjetivos(o: Objetivos): boolean {
  return Boolean(o.corto || o.medio || o.largo);
}

/** Solo los que tienen texto, en orden, listos para pintar (con su plazo, para el realismo). */
export function objetivosVisibles(
  o: Objetivos
): { plazo: PlazoDeObjetivo; etiqueta: string; texto: string }[] {
  return PLAZOS.map((p) => ({ plazo: p, etiqueta: p.etiqueta, texto: o[p.clave] })).filter((x) => x.texto);
}

/**
 * Lo que se guarda en el perfil.
 *
 * El campo antiguo se vacía a la vez: si se quedara con su texto de siempre,
 * seguiría saliendo en las pantallas viejas que aún lo lean y habría dos
 * objetivos distintos para la misma persona.
 */
export function objetivosParaGuardar(o: Objetivos): {
  goalShort: string;
  goalMid: string;
  goalLong: string;
  goal: string;
} {
  return {
    goalShort: limpiaObjetivo(o.corto),
    goalMid: limpiaObjetivo(o.medio),
    goalLong: limpiaObjetivo(o.largo),
    goal: '',
  };
}
