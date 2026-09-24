/**
 * El plan personalizado: lo que el entrenador decide sobre CÓMO funciona su
 * plan, no sobre qué ejercicios lleva.
 *
 * POR QUÉ ESTO EXISTE Y POR QUÉ SOLO AQUÍ
 *
 * Los otros dos modos tienen una forma de trabajar que es suya: la semana se
 * ata al calendario y los días sueltos rotan en bucle. El tercero no: es el
 * modo en el que el entrenador monta su método. Y montar tu método no es solo
 * elegir ejercicios — es decidir en qué unidades hablas (RIR, porcentaje, tus
 * propias letras), cuándo le preguntas al alumno, qué le enseñas antes de que
 * elija y cuánto le dejas tocar.
 *
 * Nada de esto se aplica a los otros dos modos, a propósito. Un plan semanal
 * con vocabulario propio y permisos distintos por alumno sería el mismo
 * producto contado de cuatro maneras, y entonces ninguna de las cuatro se
 * entiende. Aquí la personalización ES la función.
 *
 * VIVE EN LA RUTINA, NO EN EL PERFIL DEL ALUMNO
 *
 * Es el idioma del PLAN. El mismo alumno puede tener mañana otro plan, de otro
 * entrenador, que mida el esfuerzo de otra forma; y el mismo entrenador quiere
 * que sus veinte alumnos hablen igual sin ir cuenta por cuenta. Guardarlo en la
 * persona obligaba a las dos cosas equivocadas.
 *
 * Sin React Native dentro: así scripts/check-plan-personalizado.mjs lo recorre
 * de verdad, con sus escalas y sus casos raros, sin arrancar media app.
 */

/** Cómo se mide la proximidad al fallo. */
export type EscalaDeEsfuerzo = 'rir' | 'porcentaje' | 'propia';

/** Cuándo se le pregunta al alumno por el esfuerzo. */
export type CuandoElEsfuerzo = 'ejercicio' | 'sesion' | 'nunca';

export interface EsfuerzoDelPlan {
  escala: EscalaDeEsfuerzo;
  /**
   * Solo con 'propia': las etiquetas del entrenador, en el orden en que él las
   * entiende. No se les da significado desde aquí —pueden ser A/B/C, o
   * "suave/medio/duro", o los colores de un semáforo— porque el significado es
   * justo lo que el entrenador está aportando.
   */
  niveles?: string[];
  cuando: CuandoElEsfuerzo;
}

/** Qué se enseña de cada rutina en la pantalla de elegir. */
export interface FichaDeEleccion {
  /** El porcentaje de intensidad que puso el coach. */
  intensidad?: boolean;
  /** Cuántos ejercicios lleva. */
  ejercicios?: boolean;
  /** Cuánto se estima que dura. */
  duracion?: boolean;
  /** Qué grupos musculares toca. */
  grupos?: boolean;
}

/** Cómo se llaman las cosas en la app del alumno. */
export interface VocabularioDelPlan {
  /** Cada "día" del plan: bloque, sesión, circuito… */
  rutina?: string;
  /** Cada "serie": ronda, vuelta… */
  serie?: string;
}

/** Qué puede tocar el alumno mientras entrena. */
export interface PermisosDelAlumno {
  /** Saltarse un ejercicio sin que cuente como hecho. */
  saltar?: boolean;
  /** Cambiar el orden de los ejercicios. */
  reordenar?: boolean;
  /** Añadir a la sesión un ejercicio de otra rutina del mismo plan. */
  anadir?: boolean;
}

/**
 * LO QUE EL ENTRENADOR PRESCRIBE, que no es lo mismo que lo que el alumno
 * apunta.
 *
 * `esfuerzo` (arriba) es la pregunta que se le hace al ALUMNO al terminar:
 * "¿cuántas te quedaban?". Esto es la otra mitad, la que escribe el
 * ENTRENADOR al montar el plan: con qué intensidad va cada día y qué número
 * acompaña a cada ejercicio además de series y repeticiones.
 *
 * Hasta ahora eso estaba fijado: intensidad en porcentaje y RIR en todos los
 * ejercicios, lo usara el entrenador o no. Pero hay quien programa por RPE,
 * quien por tempo, quien por porcentaje de su máximo, quien con sus propias
 * letras, y quien no quiere ningún número: series, repeticiones y listo. Un
 * campo de RIR en cada ejercicio de alguien que no trabaja con RIR es ruido en
 * su pantalla y, peor, en la de su alumno.
 */
export type EscalaDeIntensidad = 'porcentaje' | 'propia' | 'ninguna';

export type VariableDeEjercicio = 'rir' | 'rpe' | 'porcentaje' | 'tempo' | 'propia' | 'ninguna';

export interface PrescripcionDelPlan {
  intensidad?: {
    escala: EscalaDeIntensidad;
    /**
     * Solo con 'propia': las etiquetas del entrenador para la intensidad de
     * cada día, en su orden. Letras, palabras, símbolos: lo que use con su
     * gente. Se elige una por día.
     */
    niveles?: string[];
  };
  variable?: {
    tipo: VariableDeEjercicio;
    /**
     * Solo con 'propia': cómo se llama ("Zona", "Carga", "Nivel"...). Lo que
     * se escriba en cada ejercicio es libre.
     */
    nombre?: string;
  };
}

export interface PlanPersonalizado {
  esfuerzo?: EsfuerzoDelPlan;
  ficha?: FichaDeEleccion;
  vocabulario?: VocabularioDelPlan;
  permisos?: PermisosDelAlumno;
  prescripcion?: PrescripcionDelPlan;
}

/** Lo que se guarda de un esfuerzo apuntado, sea cual sea la escala. */
export interface EsfuerzoApuntado {
  escala: EscalaDeEsfuerzo;
  /** La etiqueta elegida, tal cual se le enseñó al alumno. */
  valor: string;
}

/**
 * Lo que trae un plan personalizado recién creado.
 *
 * RIR y por ejercicio porque es lo que la app hacía hasta ahora: quien no toque
 * nada tiene que encontrarse exactamente lo de siempre. Un ajuste nuevo que
 * cambia el comportamiento por defecto no es una opción, es una sorpresa.
 */
export const POR_DEFECTO: PlanPersonalizado = {
  esfuerzo: { escala: 'rir', cuando: 'ejercicio' },
  ficha: { intensidad: true, ejercicios: true, duracion: false, grupos: false },
  vocabulario: {},
  permisos: {},
  // Porcentaje y RIR: lo que había. Quien no toque nada, lo de siempre.
  prescripcion: { intensidad: { escala: 'porcentaje' }, variable: { tipo: 'rir' } },
};

/** Las etiquetas con las que arranca la escala propia, para no empezar en blanco. */
export const NIVELES_POR_DEFECTO = ['A', 'B', 'C', 'D'];

/** Tope de etiquetas: más de seis no caben en una fila de móvil sin recortarse. */
export const MAX_NIVELES = 6;

/**
 * Las opciones que se le enseñan al alumno, en orden.
 *
 * El RIR va de "al fallo" a "me sobraban cuatro", que es como se pregunta de
 * viva voz. El porcentaje va de menos a más. Y la propia, en el orden que la
 * haya escrito el entrenador: reordenársela sería corregirle el método.
 */
export function opcionesDeEsfuerzo(e?: EsfuerzoDelPlan): string[] {
  const escala = e?.escala ?? 'rir';
  if (escala === 'rir') return ['Fallo', '1', '2', '3', '4+'];
  if (escala === 'porcentaje') return ['60 %', '70 %', '80 %', '90 %', '100 %'];
  return nivelesPropios(e);
}

/** Las etiquetas de la escala propia, limpias y acotadas. */
export function nivelesPropios(e?: EsfuerzoDelPlan): string[] {
  const puestos = (e?.niveles ?? [])
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
    .slice(0, MAX_NIVELES);
  return puestos.length > 0 ? puestos : NIVELES_POR_DEFECTO;
}

/** Lee las etiquetas que el entrenador escribe separadas por comas. */
export function nivelesDeTexto(texto: string): string[] {
  return texto
    .split(',')
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
    .slice(0, MAX_NIVELES);
}

/** La pregunta que encabeza el selector, según la escala. */
export function preguntaDeEsfuerzo(e?: EsfuerzoDelPlan): string {
  const escala = e?.escala ?? 'rir';
  if (escala === 'rir') return '¿Cuántas te quedaban?';
  if (escala === 'porcentaje') return '¿A qué porcentaje has ido?';
  return '¿Cómo ha ido?';
}

/**
 * EL RIR SE SIGUE GUARDANDO COMO NÚMERO, Y SOLO CUANDO ES UN RIR.
 *
 * Media app lee ese campo: la media de esfuerzo del bloque que ve el coach, el
 * plan de la semana, los informes. Si al elegir "80 %" o "B" se escribiera ahí
 * un número cualquiera, todas esas medias seguirían saliendo —y serían falsas,
 * que es mucho peor que no salir—. Con otra escala, el campo se queda vacío y
 * lo apuntado vive en su propio sitio.
 */
export function comoRir(escala: EscalaDeEsfuerzo, valor: string): number | undefined {
  if (escala !== 'rir') return undefined;
  if (valor === 'Fallo') return 0;
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) ? n : undefined;
}

/** El camino de vuelta: qué etiqueta corresponde a un RIR ya guardado. */
export function rirComoValor(rir?: number): string | undefined {
  if (typeof rir !== 'number') return undefined;
  if (rir <= 0) return 'Fallo';
  if (rir >= 4) return '4+';
  return String(rir);
}

/** ¿Se le pregunta el esfuerzo, y dónde? */
export function tocaPreguntarEsfuerzo(
  plan: PlanPersonalizado | undefined,
  donde: 'ejercicio' | 'sesion'
): boolean {
  return (plan?.esfuerzo?.cuando ?? 'ejercicio') === donde;
}

/** Cómo llama este plan a cada una de sus rutinas ("Día" si no se dice otra cosa). */
export function comoLlamaALaRutina(plan?: PlanPersonalizado): string {
  const v = plan?.vocabulario?.rutina?.trim();
  return v && v.length > 0 ? v : 'Día';
}

/** Cómo llama este plan a una serie. */
export function comoLlamaALaSerie(plan?: PlanPersonalizado): string {
  const v = plan?.vocabulario?.serie?.trim();
  return v && v.length > 0 ? v : 'Serie';
}

/**
 * La primera en mayúscula, para cuando la palabra encabeza una frase.
 *
 * Se reexporta la de lib/fechas en vez de escribir otra igual: dos funciones
 * que hacen lo mismo acaban comportándose distinto el día que alguien arregla
 * una (lo vigila scripts/check-fechas-sueltas.mjs).
 */
export { mayusculaInicial as enTitulo } from './fechas';

/**
 * Cuánto se estima que dura una rutina, en minutos.
 *
 * Es una ESTIMACIÓN y se presenta como tal ("≈ 35 min"). Sale de lo único que
 * se sabe antes de entrenar: cuántas series hay, cuánto se descansa entre ellas
 * y un tiempo de trabajo por serie. No cuenta el calentamiento ni el rato que
 * alguien se queda mirando el móvil, y da igual: lo que se decide con este dato
 * es "¿tengo hoy media hora o veinte minutos?".
 *
 * El último descanso no se cuenta: al acabar la última serie se acabó.
 */
export const SEGUNDOS_POR_SERIE = 45;
export const DESCANSO_POR_DEFECTO = 60;

export function minutosEstimados(
  ejercicios: { sets?: number; restSeconds?: number }[]
): number {
  let segundos = 0;
  let series = 0;
  for (const ex of ejercicios) {
    const n = Math.max(0, Math.round(ex.sets ?? 0));
    if (n === 0) continue;
    series += n;
    segundos += n * SEGUNDOS_POR_SERIE;
    segundos += n * (ex.restSeconds ?? DESCANSO_POR_DEFECTO);
  }
  if (series === 0) return 0;
  // El descanso que sobra es el de después de la última serie de todas.
  segundos -= DESCANSO_POR_DEFECTO;
  return Math.max(1, Math.round(segundos / 60));
}

/** Los grupos musculares que toca una rutina, sin repetir y en orden de aparición. */
export function gruposDeLaRutina(ejercicios: { muscleGroup?: string }[]): string[] {
  const vistos: string[] = [];
  for (const ex of ejercicios) {
    const g = ex.muscleGroup?.trim();
    if (g && !vistos.includes(g)) vistos.push(g);
  }
  return vistos;
}

// ===========================================================================
// LA PRESCRIPCIÓN
// ===========================================================================

/** Tope de etiquetas de intensidad: las mismas que caben en una fila de móvil. */
export const MAX_NIVELES_INTENSIDAD = MAX_NIVELES;

/** Con qué arrancan las etiquetas de intensidad propias, para no empezar en blanco. */
export const NIVELES_DE_INTENSIDAD_POR_DEFECTO = ['Suave', 'Media', 'Dura'];

/** Lo más largo que se acepta en el valor de un ejercicio ("3-1-1-0", "B+", "75"). */
export const LARGO_DEL_PRESCRITO = 16;

/** Lo más largo del nombre de una variable propia: tiene que caber en una etiqueta. */
export const LARGO_DEL_NOMBRE_DE_VARIABLE = 14;

/**
 * La prescripción de un plan, con lo que falte rellenado por defecto.
 *
 * Un plan guardado antes de que esto existiera no trae `prescripcion`, y tiene
 * que seguir comportándose exactamente igual: porcentaje y RIR.
 */
export function prescripcionDe(plan?: PlanPersonalizado): Required<PrescripcionDelPlan> {
  return {
    intensidad: plan?.prescripcion?.intensidad ?? { escala: 'porcentaje' },
    /*
     * La herencia de antes, respetada. Antes de que esto existiera, el "RIR 2"
     * del alumno se escondía cuando su plan medía el esfuerzo en letras o en
     * porcentaje (enseñar RIR a quien trabaja con letras es darle un objetivo
     * en unidades que su plan no usa). Un plan guardado así, sin prescripción,
     * tiene que seguir viéndose igual: sin variable. Y el entrenador lo ve
     * igual en su editor, así que lo que se guarda es lo que se ve.
     */
    variable: plan?.prescripcion?.variable ?? {
      tipo: (plan?.esfuerzo?.escala ?? 'rir') === 'rir' ? 'rir' : 'ninguna',
    },
  };
}

/** Las etiquetas de intensidad propias, limpias y acotadas. */
export function nivelesDeIntensidad(plan?: PlanPersonalizado): string[] {
  const puestos = (prescripcionDe(plan).intensidad.niveles ?? [])
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
    .slice(0, MAX_NIVELES_INTENSIDAD);
  return puestos.length > 0 ? puestos : NIVELES_DE_INTENSIDAD_POR_DEFECTO;
}

/**
 * Cómo se llama la variable de cada ejercicio, o null si no hay.
 *
 * "% RM" y no "%" a secas: un porcentaje suelto al lado de un ejercicio no dice
 * de qué, y en calistenia hay quien lo lee como porcentaje de esfuerzo.
 */
export function nombreDeLaVariable(plan?: PlanPersonalizado): string | null {
  const v = prescripcionDe(plan).variable;
  switch (v.tipo) {
    case 'rir':
      return 'RIR';
    case 'rpe':
      return 'RPE';
    case 'porcentaje':
      return '% RM';
    case 'tempo':
      return 'Tempo';
    case 'propia': {
      const n = (v.nombre ?? '').trim().slice(0, LARGO_DEL_NOMBRE_DE_VARIABLE);
      return n || 'Objetivo';
    }
    default:
      return null;
  }
}

/** Qué se sugiere en el campo vacío, para que se entienda qué va ahí. */
export function ejemploDeLaVariable(plan?: PlanPersonalizado): string {
  switch (prescripcionDe(plan).variable.tipo) {
    case 'rir':
      return '2';
    case 'rpe':
      return '8';
    case 'porcentaje':
      return '75';
    case 'tempo':
      return '3-1-1-0';
    default:
      return '';
  }
}

/** El valor de un ejercicio tal y como se guarda: sin espacios de más y con tope. */
export function limpiarPrescrito(texto: string): string {
  return (texto ?? '').replace(/\s+/g, ' ').trim().slice(0, LARGO_DEL_PRESCRITO);
}

/**
 * Lo que ve el ALUMNO junto a un ejercicio: "RIR 2", "RPE 8", "75 % RM",
 * "Tempo 3-1-1-0", "Zona B". Null si no hay nada que enseñar.
 *
 * `plan` sin prescripción —los planes semanales, los ciclos y los
 * personalizados de antes— se lee como RIR, que es lo que la app enseñaba.
 */
export function textoDePrescripcion(
  ex: { rir?: number | null; prescrito?: string },
  plan?: PlanPersonalizado
): string | null {
  const tipo = prescripcionDe(plan).variable.tipo;
  if (tipo === 'ninguna') return null;
  if (tipo === 'rir') {
    return typeof ex.rir === 'number' ? `RIR ${ex.rir}` : null;
  }
  const valor = limpiarPrescrito(ex.prescrito ?? '');
  if (!valor) return null;
  if (tipo === 'porcentaje') return `${valor.replace(/\s*%$/, '')} % RM`;
  return `${nombreDeLaVariable(plan)} ${valor}`;
}

/** La intensidad de un día tal y como se lee: "80 %", "Media", "B". Null si no hay. */
export function textoDeIntensidadDelDia(
  day: { intensityPct?: number; intensityLabel?: string },
  plan?: PlanPersonalizado
): string | null {
  const escala = prescripcionDe(plan).intensidad.escala;
  if (escala === 'ninguna') return null;
  if (escala === 'propia') return day.intensityLabel?.trim() || null;
  return day.intensityPct ? `${day.intensityPct} %` : null;
}

/**
 * LOS DÍAS TAL Y COMO SE GUARDAN: cada valor en su sitio, y solo el que toca.
 *
 * EL RIR SE QUEDA COMO NÚMERO Y SOLO EN UN PLAN QUE PRESCRIBE RIR. Es lo mismo
 * que protege `comoRir` con lo que apunta el alumno, desde el otro lado: media
 * app lee ese campo —la media de esfuerzo del bloque, el plan de la semana,
 * los informes—. Si el entrenador cambia su plan de RIR a tempo, los RIR que
 * tuviera escritos se quedarían ahí escondidos... y seguirían entrando en
 * todas esas medias, de un plan que ya no los usa. Se van al guardar.
 *
 * Lo mismo con la intensidad del día: un 80 % olvidado debajo de una "B"
 * seguiría saliendo en el registro de la sesión.
 *
 * Mientras se edita no se borra nada —quien cambia de escala y vuelve no
 * pierde lo escrito—; se limpia al guardar, que es cuando se decide.
 */
export function diasParaGuardar<
  D extends {
    intensityPct?: number;
    intensityLabel?: string;
    exercises: { rir?: number; prescrito?: string }[];
  },
>(dias: D[], plan?: PlanPersonalizado): D[] {
  const { intensidad, variable } = prescripcionDe(plan);
  return dias.map((d) => {
    const dia = { ...d };
    if (intensidad.escala !== 'porcentaje') delete dia.intensityPct;
    if (intensidad.escala !== 'propia' || !dia.intensityLabel?.trim()) delete dia.intensityLabel;
    dia.exercises = d.exercises.map((e) => {
      const ex = { ...e };
      if (variable.tipo !== 'rir') delete ex.rir;
      const valor = limpiarPrescrito(ex.prescrito ?? '');
      if (variable.tipo === 'rir' || variable.tipo === 'ninguna' || !valor) delete ex.prescrito;
      else ex.prescrito = valor;
      return ex;
    });
    return dia;
  });
}

/**
 * Lo que escribe el entrenador en la casilla de RIR, ya convertido.
 *
 * VACÍO ES "SIN RIR", NO ES CERO. Antes esto hacía `Number(texto) || 0`, así
 * que borrar el RIR de un ejercicio no lo quitaba: lo dejaba en 0, que es
 * "al fallo". El entrenador creía haber quitado la indicación y al alumno le
 * llegaba la más dura de todas.
 */
export function rirDeTexto(texto: string): number | undefined {
  const limpio = (texto ?? '').trim();
  if (!limpio) return undefined;
  const n = Number.parseInt(limpio, 10);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(10, n));
}

/** Un resumen de la configuración, para la lista de plantillas. */
export function resumenDePrescripcion(plan?: PlanPersonalizado): string {
  const { intensidad } = prescripcionDe(plan);
  const partes: string[] = [];
  if (intensidad.escala === 'porcentaje') partes.push('Intensidad en %');
  else if (intensidad.escala === 'propia') partes.push(`Intensidad: ${nivelesDeIntensidad(plan).join(' / ')}`);
  const variable = nombreDeLaVariable(plan);
  partes.push(variable ? `Por ejercicio: ${variable}` : 'Sin variable por ejercicio');
  return partes.join(' · ');
}
