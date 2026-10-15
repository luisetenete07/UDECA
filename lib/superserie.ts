/**
 * LA SUPERSERIE, RONDA A RONDA.
 *
 * Una superserie son dos (o más) ejercicios que se hacen seguidos, sin
 * descanso entre ellos: una serie de A, una de B, y entonces sí, descanso. Así
 * se entrena, así que así se apunta: A1 → B1 → descanso → A2 → B2 → descanso.
 *
 * Antes la pantalla del entreno enseñaba un ejercicio cada vez. Al marcar la
 * serie de A no pasaba nada —ni descanso ni aviso— y el alumno tenía que darse
 * cuenta solo de que tocaba B e ir a buscarlo. Ahora el bloque entero va en una
 * tarjeta por rondas, y esto decide qué toca después de cada serie.
 *
 * El plan marca la superserie en el SEGUNDO ejercicio (`supersetWithPrevious`):
 * "este va encadenado con el de antes". Un bloque es el primero más todos los
 * que le siguen encadenados.
 */

/** Lo que hace falta saber de cada ejercicio de la sesión en curso. */
export interface EnCurso {
  name?: string;
  saltado?: boolean;
  sets: { completed?: boolean }[];
}

/** Lo que hace falta saber de cada ejercicio del plan del día. */
export interface EnElPlan {
  supersetWithPrevious?: boolean;
  restSeconds?: number;
}

export interface Bloque {
  inicio: number;
  fin: number;
}

export interface Paso {
  ejercicio: number;
  serie: number;
}

/** El bloque (superserie o ejercicio suelto) al que pertenece el ejercicio `i`. */
export function bloqueDe(plan: EnElPlan[], i: number, total = plan.length): Bloque {
  let inicio = Math.max(0, Math.min(i, total - 1));
  // El primero de la sesión nunca va encadenado con nada, lo diga o no el plan.
  while (inicio > 0 && plan[inicio]?.supersetWithPrevious) inicio--;
  let fin = inicio;
  while (fin + 1 < total && plan[fin + 1]?.supersetWithPrevious) fin++;
  // Si `i` cayó fuera (lista corta), al menos que el bloque lo contenga.
  return { inicio, fin: Math.max(fin, Math.min(i, total - 1)) };
}

/** ¿Es una superserie de verdad (más de un ejercicio)? */
export function esSuperserie(b: Bloque): boolean {
  return b.fin > b.inicio;
}

/** Los ejercicios del bloque, en orden. */
export function miembros(b: Bloque): number[] {
  return Array.from({ length: b.fin - b.inicio + 1 }, (_, k) => b.inicio + k);
}

/** Cuántas rondas tiene el bloque: las del que más series lleva (sin los saltados). */
export function rondasDe(log: EnCurso[], b: Bloque): number {
  let n = 0;
  for (const i of miembros(b)) {
    const ex = log[i];
    if (ex && !ex.saltado) n = Math.max(n, ex.sets.length);
  }
  return n;
}

/** La siguiente serie por hacer del bloque, ronda a ronda: A1, B1, A2, B2… */
export function siguienteDelBloque(log: EnCurso[], b: Bloque): Paso | null {
  const rondas = rondasDe(log, b);
  for (let r = 0; r < rondas; r++) {
    for (const i of miembros(b)) {
      const ex = log[i];
      if (!ex || ex.saltado || r >= ex.sets.length) continue;
      if (!ex.sets[r].completed) return { ejercicio: i, serie: r };
    }
  }
  return null;
}

/**
 * El descanso al acabar una ronda.
 *
 * El del último del bloque, que es tras el que se descansa; si no lleva, el
 * mayor de los demás (el entrenador pudo ponerlo en el primero). Cero si
 * ninguno dice nada: quien llama pone el de por defecto.
 */
export function descansoDelBloque(plan: EnElPlan[], b: Bloque): number {
  const ultimo = plan[b.fin]?.restSeconds ?? 0;
  if (ultimo > 0) return ultimo;
  return Math.max(0, ...miembros(b).map((i) => plan[i]?.restSeconds ?? 0));
}

/** Los ejercicios que tienen serie en la ronda `r` (sin los saltados). */
export function enLaRonda(log: EnCurso[], b: Bloque, r: number): number[] {
  return miembros(b).filter((i) => {
    const ex = log[i];
    return !!ex && !ex.saltado && r < ex.sets.length;
  });
}

/**
 * Si la ronda `r` la hace UN solo ejercicio porque los demás ya terminaron sus
 * series, ese ejercicio; si no, null.
 *
 * Pasa cuando el entrenador pone, por ejemplo, 2 series de A y 3 de B: la
 * tercera de B ya no tiene con quién encadenarse. No es una superserie a
 * medias, es una serie suelta, y se trata como tal: sola, con su descanso.
 */
export function serieSuelta(log: EnCurso[], b: Bloque, r: number): number | null {
  if (!esSuperserie(b)) return null;
  const quienes = enLaRonda(log, b, r);
  if (quienes.length !== 1) return null;
  // Que los demás hayan TERMINADO (no saltado): si no, no es suelta, es que
  // el otro se ha quedado fuera hoy.
  const terminados = miembros(b).filter((j) => {
    const ex = log[j];
    return j !== quienes[0] && !!ex && !ex.saltado && r >= ex.sets.length;
  });
  return terminados.length > 0 ? quienes[0] : null;
}

/**
 * El descanso después de la ronda `r`.
 *
 * El de la superserie, salvo si la ronda era una serie suelta: entonces el del
 * propio ejercicio, que es el que el entrenador pensó para él solo.
 */
export function descansoTrasRonda(plan: EnElPlan[], log: EnCurso[], b: Bloque, r: number): number {
  const suelta = serieSuelta(log, b, r);
  if (suelta !== null && (plan[suelta]?.restSeconds ?? 0) > 0) return plan[suelta]!.restSeconds!;
  return descansoDelBloque(plan, b);
}

export type TrasLaSerie =
  /** Otro ejercicio de la misma ronda: se hace YA, sin descanso. */
  | { tipo: 'encadenar'; siguiente: Paso }
  /**
   * Se acabó la ronda (o la serie de un ejercicio suelto): toca descansar.
   * `siguiente` es lo que viene después del descanso, o null si ya está todo.
   * `bloqueTerminado` dice si hay que pasar al siguiente ejercicio.
   */
  | { tipo: 'descansar'; siguiente: Paso | null; bloqueTerminado: boolean };

/**
 * Qué toca justo después de marcar la serie `serie` del ejercicio `i`.
 *
 * `log` tiene que llevar YA la serie marcada (el estado de React aún no la
 * tiene cuando se pregunta). Si el alumno va fuera de orden —hace B antes que
 * A—, lo que queda de esa ronda se encadena igual: el descanso solo llega
 * cuando la ronda está entera.
 */
export function trasMarcarSerie(
  log: EnCurso[],
  plan: EnElPlan[],
  i: number,
  serie: number
): TrasLaSerie {
  const b = bloqueDe(plan, i, log.length);
  if (esSuperserie(b)) {
    // Primero los que van DETRÁS en la ronda (el orden natural), luego los de
    // delante (si se saltó alguno sin querer).
    const orden = [...miembros(b).filter((j) => j > i), ...miembros(b).filter((j) => j < i)];
    for (const j of orden) {
      const ex = log[j];
      if (!ex || ex.saltado || serie >= ex.sets.length) continue;
      if (!ex.sets[serie].completed) return { tipo: 'encadenar', siguiente: { ejercicio: j, serie } };
    }
  }
  const delBloque = siguienteDelBloque(log, b);
  if (delBloque) return { tipo: 'descansar', siguiente: delBloque, bloqueTerminado: false };
  // Bloque terminado: lo siguiente, en el primer bloque de después que tenga algo.
  for (let k = b.fin + 1; k < log.length; ) {
    const otro = bloqueDe(plan, k, log.length);
    const paso = siguienteDelBloque(log, otro);
    if (paso) return { tipo: 'descansar', siguiente: paso, bloqueTerminado: true };
    k = otro.fin + 1;
  }
  return { tipo: 'descansar', siguiente: null, bloqueTerminado: true };
}
