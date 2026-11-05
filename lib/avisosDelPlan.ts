import { frase, t } from './idioma';
import { nombreDelDia } from './schedule';
import { unido } from './texto';
import {
  isDualMeasure,
  isHoldMeasure,
  WEEKDAY_NAMES,
  type ExerciseMeasure,
  type Routine,
  type RoutineDay,
  type RoutineExercise,
} from './types';

/**
 * LAS NOTIFICACIONES DEL ALUMNO: lo que su entrenador ha cambiado del plan.
 *
 * Al guardar la rutina, la app del entrenador compara el plan como estaba con
 * el plan como queda y apunta un aviso con los DÍAS tocados: los nuevos, los
 * cambiados y los quitados, cada uno con sus ejercicios tal y como quedan y lo
 * que cambió en cada uno ("3 × 8 → 4 × 8", "descanso", "nota"). Si son varios
 * días, van todos.
 *
 * Se guarda el día entero y no solo un "ha cambiado": el alumno abre el aviso
 * y ve el día con lo nuevo marcado, sin tener que adivinar qué fue. Y no
 * depende de la rutina de ahora: si mañana se vuelve a cambiar, el aviso de hoy
 * sigue diciendo lo de hoy.
 *
 * Guardar sin cambiar nada no avisa de nada.
 */

export type EstadoDelCambio = 'nuevo' | 'cambiado' | 'quitado';

export interface EjercicioDelAviso {
  nombre: string;
  /** Lo que hay que hacer, tal y como quedó: "4 × 8-10", "3 × 30 s". */
  cuanto: string;
  /** Solo en un día cambiado: si este ejercicio es nuevo o ha cambiado. */
  estado?: 'nuevo' | 'cambiado';
  /** Qué cambió, además de las series y repeticiones (ver ETIQUETA_DEL_EJERCICIO). */
  que?: string[];
  /** Cómo estaba, si cambiaron las series o las repeticiones ("3 × 8"). */
  antes?: string;
  /** Cómo se llamaba, si el entrenador cambió el ejercicio por otro. */
  antesNombre?: string;
  /** Va en superserie con el anterior. */
  superserie?: boolean;
}

export interface DiaDelAviso {
  dayId: string;
  /** El nombre guardado ("Día 2", "Empuje"); se enseña con `nombreDelDia`. */
  nombre: string;
  /** Su posición en el plan (para "Día 3" si no tiene nombre). */
  indice: number;
  /** En la semana: el día al que va (0 = lunes). */
  weekday?: number;
  /** En los días sueltos (ciclo): su número en la rueda ("Día 2 · Empuje"). */
  diaDelCiclo?: number;
  estado: EstadoDelCambio;
  /** Lo que cambió del día en sí, no de un ejercicio (ver ETIQUETA_DEL_DIA). */
  que?: string[];
  /** El día como quedó, entero. Vacío si se quitó. */
  ejercicios: EjercicioDelAviso[];
  /** Los ejercicios que ya no están. */
  quitados?: string[];
}

export interface AvisoDelPlan {
  id: string;
  trainerId: string;
  clientId: string;
  tipo: 'plan';
  routineId: string;
  /** El nombre del plan al guardarlo. */
  plan: string;
  /** Es un plan nuevo entero, no un cambio en el que tenía. */
  nuevo?: boolean;
  dias: DiaDelAviso[];
  /** Lo que cambió del plan en general (ver ETIQUETA_DEL_PLAN). */
  ajustes?: string[];
  /** Cuándo se guardó (hora del servidor). */
  cuando: number;
}

export interface CambiosDelPlan {
  dias: DiaDelAviso[];
  ajustes: string[];
}

/** Lo del plan que se compara. */
export type PlanComparable = Pick<
  Routine,
  'name' | 'days' | 'schedule' | 'scheduleLabel' | 'cycleStartDate' | 'personalizado' | 'prescripcion' | 'visibilidad' | 'modoAlumno'
>;

/** Lo que cambió de un ejercicio, para leerlo. Las series y reps van en `antes`. */
export const ETIQUETA_DEL_EJERCICIO: Record<string, string> = {
  descanso: 'Descanso',
  nota: 'Nota',
  intensidad: 'Intensidad',
  agarre: 'Agarre',
  carga: 'Carga',
  meta: 'Meta',
  cluster: 'Clúster',
  superserie: 'Superserie',
  regresion: 'Regresión',
  otros: 'Otros detalles',
};

/** Lo que cambió del día en sí. */
export const ETIQUETA_DEL_DIA: Record<string, string> = {
  nombre: 'Nombre',
  dia: 'Día de la semana',
  descanso: 'Descanso',
  intensidad: 'Intensidad del día',
  gtg: 'Grease the groove',
  indicaciones: 'Indicaciones',
  temporizador: 'Temporizador',
  calentamiento: 'Calentamiento',
  orden: 'Orden de los ejercicios',
  otros: 'Otros detalles',
};

/** Lo que cambió del plan en general. */
export const ETIQUETA_DEL_PLAN: Record<string, string> = {
  nombre: 'Nombre del plan',
  tipo: 'Tipo de plan',
  fecha: 'Día en que empieza el ciclo',
  configuracion: 'Cómo se mide el esfuerzo',
  visibilidad: 'Qué ves al entrenar',
  vista: 'En la app o en tabla',
  esfuerzo: 'Si se te pregunta el esfuerzo',
};

/* ------------------------------------------------------------------ */
/* Comparar sin falsos cambios                                         */
/* ------------------------------------------------------------------ */

/**
 * Un valor tal y como se compara. Lo vacío es lo mismo que no ponerlo: un
 * `undefined`, un `''`, un `false` o una lista vacía no son un cambio —el
 * editor guarda unos u otros según por dónde se haya pasado—, y avisar de
 * ellos sería avisar de nada.
 */
function limpio(v: unknown): unknown {
  if (v === undefined || v === null || v === '' || v === false) return undefined;
  if (Array.isArray(v)) {
    const l = v.map(limpio);
    return l.length > 0 ? l : undefined;
  }
  if (typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      const x = limpio((v as Record<string, unknown>)[k]);
      if (x !== undefined) o[k] = x;
    }
    return Object.keys(o).length > 0 ? o : undefined;
  }
  return v;
}

function igual(a: unknown, b: unknown): boolean {
  return JSON.stringify(limpio(a)) === JSON.stringify(limpio(b));
}

/** Las claves en que difieren dos objetos (las vacías cuentan como iguales). */
function clavesDistintas(a: object, b: object): string[] {
  const claves = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...claves].filter(
    (k) => !igual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
  );
}

/* ------------------------------------------------------------------ */
/* Ejercicios                                                          */
/* ------------------------------------------------------------------ */

/** Las claves que se leen en `cuanto` ("3 × 8"): su cambio va en `antes`. */
const DEL_CUANTO = new Set(['sets', 'reps', 'seconds', 'side2', 'measure']);

/** Campo del ejercicio → lo que se le dice al alumno. Lo interno no avisa. */
const CAMPO_DEL_EJERCICIO: Record<string, string | null> = {
  id: null,
  exerciseId: null,
  name: null,
  restSeconds: 'descanso',
  notes: 'nota',
  rir: 'intensidad',
  prescrito: 'intensidad',
  grip: 'agarre',
  load: 'carga',
  band: 'carga',
  goal: 'meta',
  cluster: 'cluster',
  supersetWithPrevious: 'superserie',
  transicionSegundos: 'superserie',
  permiteRegresion: 'regresion',
  // Cosas de la biblioteca o de la fusión que el alumno no ve como tales.
  muscleGroup: null,
  subgroup: null,
  aislado: null,
};

/** "4 × 8-10", "3 × 30 s", "3 × 8 + 20 s", "3 × 8/8". */
export function cuantoDelEjercicio(ex: RoutineExercise, medida?: ExerciseMeasure): string {
  const m = ex.measure ?? medida;
  const series = ex.sets > 0 ? `${ex.sets} × ` : '';
  const reps = (ex.reps ?? '').trim();
  const seg = (ex.seconds ?? '').trim();
  const lado2 = (ex.side2 ?? '').trim();
  if (isHoldMeasure(m)) {
    const a = seg || reps || '—';
    return isDualMeasure(m) && lado2 ? `${series}${a}/${lado2} s` : `${series}${a} s`;
  }
  if (m === 'combo') return seg ? `${series}${reps || '—'} + ${seg} s` : `${series}${reps || '—'}`;
  if (isDualMeasure(m) && lado2) return `${series}${reps || '—'}/${lado2}`;
  return `${series}${reps || '—'}`;
}

function ejercicioDelAviso(ex: RoutineExercise, medidaDe?: (ex: RoutineExercise) => ExerciseMeasure | undefined): EjercicioDelAviso {
  return {
    nombre: ex.name,
    cuanto: cuantoDelEjercicio(ex, medidaDe?.(ex)),
    ...(ex.supersetWithPrevious ? { superserie: true } : {}),
  };
}

/** Lo que cambió de un ejercicio que sigue en el día (null: nada). */
function cambioDelEjercicio(
  antes: RoutineExercise,
  ahora: RoutineExercise,
  medidaDe?: (ex: RoutineExercise) => ExerciseMeasure | undefined
): EjercicioDelAviso | null {
  const distintas = clavesDistintas(antes, ahora);
  if (distintas.length === 0) return null;
  const base = ejercicioDelAviso(ahora, medidaDe);
  const otroEjercicio = distintas.includes('exerciseId') || (distintas.includes('name') && antes.name.trim() !== ahora.name.trim());
  const cuantoAntes = cuantoDelEjercicio(antes, medidaDe?.(antes));
  const cambioElCuanto = distintas.some((k) => DEL_CUANTO.has(k)) && cuantoAntes !== base.cuanto;
  const que = [
    ...new Set(
      distintas
        .filter((k) => !DEL_CUANTO.has(k))
        .map((k) => (k in CAMPO_DEL_EJERCICIO ? CAMPO_DEL_EJERCICIO[k] : 'otros'))
        .filter((k): k is string => !!k)
    ),
  ];
  // Solo cambió algo que no se enseña (el grupo muscular, la fusión): no es un cambio para él.
  if (!otroEjercicio && !cambioElCuanto && que.length === 0) return null;
  return {
    ...base,
    estado: 'cambiado',
    ...(que.length > 0 ? { que } : {}),
    ...(cambioElCuanto ? { antes: cuantoAntes } : {}),
    ...(otroEjercicio ? { antesNombre: antes.name } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Días                                                                */
/* ------------------------------------------------------------------ */

const CAMPO_DEL_DIA: Record<string, string | null> = {
  id: null,
  exercises: null,
  name: 'nombre',
  weekday: 'dia',
  isRest: 'descanso',
  optionalRest: 'descanso',
  intensity: 'intensidad',
  intensityPct: 'intensidad',
  intensityLabel: 'intensidad',
  gtg: 'gtg',
  gtgSetsPerDay: 'gtg',
  gtgIndicaciones: 'indicaciones',
  showIntervalTimer: 'temporizador',
  approachesNote: 'calentamiento',
  calentamiento: 'calentamiento',
};

function cabeceraDelDia(d: RoutineDay, indice: number, ciclo: boolean) {
  return {
    dayId: d.id,
    nombre: d.name ?? '',
    indice,
    ...(!ciclo && typeof d.weekday === 'number' ? { weekday: d.weekday } : {}),
    ...(ciclo ? { diaDelCiclo: indice + 1 } : {}),
  };
}

/** Un día como sale en el aviso, sin nada marcado (día nuevo o plan nuevo). */
function diaEntero(
  d: RoutineDay,
  indice: number,
  ciclo: boolean,
  medidaDe?: (ex: RoutineExercise) => ExerciseMeasure | undefined
): DiaDelAviso {
  return {
    ...cabeceraDelDia(d, indice, ciclo),
    estado: 'nuevo',
    ejercicios: d.exercises.map((e) => ejercicioDelAviso(e, medidaDe)),
  };
}

/** Lo que cambió de un día que ya estaba (null: nada que contar). */
function cambioDelDia(
  antes: RoutineDay,
  ahora: RoutineDay,
  indice: number,
  ciclo: boolean,
  medidaDe?: (ex: RoutineExercise) => ExerciseMeasure | undefined
): DiaDelAviso | null {
  const que = [
    ...new Set(
      clavesDistintas(antes, ahora)
        .map((k) => (k in CAMPO_DEL_DIA ? CAMPO_DEL_DIA[k] : 'otros'))
        .filter((k): k is string => !!k)
    ),
  ];
  const previos = new Map(antes.exercises.map((e) => [e.id, e]));
  const siguen = new Set(ahora.exercises.map((e) => e.id));
  let tocados = 0;
  const ejercicios = ahora.exercises.map((e) => {
    const previo = previos.get(e.id);
    if (!previo) {
      tocados++;
      return { ...ejercicioDelAviso(e, medidaDe), estado: 'nuevo' as const };
    }
    const cambio = cambioDelEjercicio(previo, e, medidaDe);
    if (cambio) tocados++;
    return cambio ?? ejercicioDelAviso(e, medidaDe);
  });
  const quitados = antes.exercises.filter((e) => !siguen.has(e.id)).map((e) => e.name);
  // El mismo orden de los que siguen: si no, se movió alguno.
  const ordenAntes = antes.exercises.filter((e) => siguen.has(e.id)).map((e) => e.id);
  const ordenAhora = ahora.exercises.filter((e) => previos.has(e.id)).map((e) => e.id);
  if (ordenAntes.join('|') !== ordenAhora.join('|')) que.push('orden');
  if (que.length === 0 && tocados === 0 && quitados.length === 0) return null;
  return {
    ...cabeceraDelDia(ahora, indice, ciclo),
    estado: 'cambiado',
    ...(que.length > 0 ? { que } : {}),
    ejercicios,
    ...(quitados.length > 0 ? { quitados } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* El plan                                                             */
/* ------------------------------------------------------------------ */

/**
 * Qué ha cambiado del plan: los días tocados (en el orden del plan, y los
 * quitados al final) y lo que cambió del plan en general.
 *
 * Sin `antes`, el plan es nuevo: todos sus días, sin nada marcado.
 */
export function cambiosDelPlan(
  antes: PlanComparable | null | undefined,
  ahora: PlanComparable,
  medidaDe?: (ex: RoutineExercise) => ExerciseMeasure | undefined
): CambiosDelPlan {
  const enCiclo = (p: PlanComparable) => (p.schedule ?? 'weekly') === 'cycle';
  if (!antes) {
    return { dias: ahora.days.map((d, i) => diaEntero(d, i, enCiclo(ahora), medidaDe)), ajustes: [] };
  }
  const previos = new Map(antes.days.map((d) => [d.id, d]));
  const siguen = new Set(ahora.days.map((d) => d.id));
  const dias: DiaDelAviso[] = [];
  ahora.days.forEach((d, i) => {
    const previo = previos.get(d.id);
    if (!previo) dias.push(diaEntero(d, i, enCiclo(ahora), medidaDe));
    else {
      const c = cambioDelDia(previo, d, i, enCiclo(ahora), medidaDe);
      if (c) dias.push(c);
    }
  });
  antes.days.forEach((d, i) => {
    if (!siguen.has(d.id)) dias.push({ ...cabeceraDelDia(d, i, enCiclo(antes)), estado: 'quitado', ejercicios: [] });
  });

  const ajustes: string[] = [];
  if ((antes.name ?? '').trim() !== (ahora.name ?? '').trim()) ajustes.push('nombre');
  if (!igual(antes.schedule ?? 'weekly', ahora.schedule ?? 'weekly') || !igual(antes.scheduleLabel, ahora.scheduleLabel)) {
    ajustes.push('tipo');
  }
  if ((ahora.schedule ?? 'weekly') === 'cycle' && (antes.schedule ?? 'weekly') === 'cycle' && !igual(antes.cycleStartDate, ahora.cycleStartDate)) {
    ajustes.push('fecha');
  }
  if (!igual(antes.personalizado, ahora.personalizado) || !igual(antes.prescripcion, ahora.prescripcion)) {
    ajustes.push('configuracion');
  }
  if (!igual(antes.visibilidad, ahora.visibilidad)) ajustes.push('visibilidad');
  if ((antes.modoAlumno ?? 'app') !== (ahora.modoAlumno ?? 'app')) ajustes.push('vista');
  return { dias, ajustes };
}

export function hayCambios(c: CambiosDelPlan): boolean {
  return c.dias.length > 0 || c.ajustes.length > 0;
}

/* ------------------------------------------------------------------ */
/* Cómo se lee                                                         */
/* ------------------------------------------------------------------ */

/** "Lunes, Miércoles y Viernes". */
function enLista(cosas: string[]): string {
  if (cosas.length <= 1) return cosas[0] ?? '';
  return frase`${cosas.slice(0, -1).join(', ')} y ${cosas[cosas.length - 1]}`;
}

/** "Lunes · Empuje", "Día 2 · Empuje", "Día 3", "Pierna". */
export function nombreDelDiaDelAviso(d: Pick<DiaDelAviso, 'nombre' | 'indice' | 'weekday' | 'diaDelCiclo'>): string {
  const nombre = nombreDelDia(d.nombre, d.indice);
  if (typeof d.diaDelCiclo === 'number') {
    const numero = frase`Día ${d.diaDelCiclo}`;
    return nombre.toLowerCase() === numero.toLowerCase() ? numero : `${numero} · ${nombre}`;
  }
  if (typeof d.weekday !== 'number' || !WEEKDAY_NAMES[d.weekday]) return nombre;
  const semana = t(WEEKDAY_NAMES[d.weekday]);
  return nombre.toLowerCase() === semana.toLowerCase() ? semana : `${semana} · ${nombre}`;
}

/** El texto de la notificación del móvil: qué días, con su nombre. */
export function textoDelAviso(plan: string, c: CambiosDelPlan, nuevo: boolean): string {
  if (nuevo) return frase`Tu entrenador te ha preparado un plan nuevo: ${plan}`;
  const nombres = c.dias.map(nombreDelDiaDelAviso);
  if (nombres.length === 0) return frase`Tu entrenador ha cambiado los ajustes de tu plan: ${plan}`;
  if (nombres.length <= 3) return frase`Tu entrenador ha cambiado ${enLista(nombres)}`;
  return frase`Tu entrenador ha cambiado ${nombres.length} días de tu plan`;
}

/** "Series 3 × 8 → 4 × 8", "Nuevo", "Descanso y nota". */
export function textoDelCambio(e: EjercicioDelAviso): string {
  if (e.estado === 'nuevo') return t('Nuevo');
  const partes = [
    e.antesNombre ? frase`Antes: ${e.antesNombre}` : '',
    e.antes ? `${e.antes} → ${e.cuanto}` : '',
    enLista(
      (e.que ?? [])
        .map((k) => t(ETIQUETA_DEL_EJERCICIO[k] ?? ETIQUETA_DEL_EJERCICIO.otros))
        .map((s, i) => (i === 0 ? s : s.toLowerCase()))
    ),
  ].filter(Boolean);
  return unido(...partes);
}

/** Lo que pasó con un día, en una línea: "2 cambios · 1 nuevo · 1 quitado". */
export function resumenDelDia(d: DiaDelAviso): string {
  if (d.estado === 'quitado') return t('Ya no está en tu plan');
  if (d.estado === 'nuevo') {
    return d.ejercicios.length === 1 ? t('Día nuevo · 1 ejercicio') : frase`Día nuevo · ${d.ejercicios.length} ejercicios`;
  }
  const nuevos = d.ejercicios.filter((e) => e.estado === 'nuevo').length;
  const cambiados = d.ejercicios.filter((e) => e.estado === 'cambiado').length;
  const quitados = d.quitados?.length ?? 0;
  const partes = [
    cambiados === 1 ? t('1 cambiado') : cambiados > 1 ? frase`${cambiados} cambiados` : '',
    nuevos === 1 ? t('1 nuevo') : nuevos > 1 ? frase`${nuevos} nuevos` : '',
    quitados === 1 ? t('1 quitado') : quitados > 1 ? frase`${quitados} quitados` : '',
    ...(d.que ?? []).map((k) => t(ETIQUETA_DEL_DIA[k] ?? ETIQUETA_DEL_DIA.otros)),
  ];
  return unido(...partes);
}

/** Cuántos avisos no ha visto todavía. */
export function avisosSinVer(avisos: Pick<AvisoDelPlan, 'cuando'>[], vistos: number | undefined): number {
  return avisos.filter((a) => a.cuando > (vistos ?? 0)).length;
}
