import { inicioDelDia } from './fechas';
import { frase, t } from './idioma';
import { flexLabel, nombreDelDia } from './schedule';
import {
  cuantoDelEjercicio,
  ETIQUETA_DEL_DIA,
  ETIQUETA_DEL_EJERCICIO,
  ETIQUETA_DEL_PLAN,
  nombreDelDiaDelAviso,
  type AvisoDelPlan,
} from './avisosDelPlan';
import {
  WEEKDAY_NAMES,
  type ExerciseMeasure,
  type Routine,
  type RoutineDay,
  type TrainingCycle,
  type WorkoutLog,
} from './types';

/**
 * EL INFORME DE CAMBIOS: todo lo que el entrenador ha ido cambiando del
 * entrenamiento de un alumno, ordenado por el día del cambio.
 *
 * Es el documento para enseñar el trabajo hecho —en un vídeo, a otro alumno, al
 * propio alumno—: qué planes ha tenido, qué tipos de entreno, y cada
 * modificación de rutina, ejercicios y series, día a día. El entrenador elige
 * el periodo y qué entra.
 *
 * DE DÓNDE SALE CADA COSA
 *
 *  - Los cambios del plan, del registro que se apunta al guardar la rutina
 *    (lib/avisosDelPlan.ts). Es lo exacto, pero existe desde que existe ese
 *    registro: el 1 de noviembre de 2026.
 *  - Lo de antes se DEDUCE de los entrenos: qué ejercicios hacía en cada tipo
 *    de día y cuántas series, sesión a sesión. Un entreno no guarda las
 *    repeticiones pautadas, así que eso no se puede saber, y se dice. Para no
 *    confundir un día suelto (se saltó un ejercicio, añadió una serie) con un
 *    cambio del plan, solo cuenta lo que se repite en la sesión siguiente.
 *  - Los planes enteros, de las rutinas guardadas: cuándo empezó cada una.
 *  - Las semanas de los ciclos, de lo que el entrenador programó en cada una.
 */

/** Desde cuándo se apuntan los cambios del plan al guardarlo (el registro exacto). */
export const INICIO_DEL_REGISTRO = new Date(2026, 10, 1).getTime();

export interface OpcionesDelInforme {
  /** Los planes que ha tenido y los tipos de entreno que hizo con cada uno. */
  planes: boolean;
  /** Planes nuevos, días añadidos, quitados o renombrados y ajustes del plan. */
  rutina: boolean;
  /** Ejercicios nuevos, quitados o cambiados por otro. */
  ejercicios: boolean;
  /** Series y repeticiones: "3 × 8 → 4 × 8". */
  series: boolean;
  /** Descanso, notas, intensidad, agarre, carga… */
  detalles: boolean;
  /** Los bloques y lo programado en cada semana de los ciclos. */
  semanas: boolean;
}

export const TODO_EL_INFORME: OpcionesDelInforme = {
  planes: true,
  rutina: true,
  ejercicios: true,
  series: true,
  detalles: true,
  semanas: true,
};

export type TipoDeLinea = 'nuevo' | 'quitado' | 'sustituido' | 'series' | 'detalle' | 'dia' | 'contenido';

export interface LineaDelInforme {
  tipo: TipoDeLinea;
  texto: string;
}

export interface DiaDelEvento {
  nombre: string;
  lineas: LineaDelInforme[];
}

export type FuenteDelEvento = 'plan-nuevo' | 'cambio' | 'ciclo' | 'entrenos';

export interface EventoDelInforme {
  cuando: number;
  fuente: FuenteDelEvento;
  titulo: string;
  /** Líneas sueltas del evento, sin día (ajustes del plan, objetivo del bloque). */
  notas: string[];
  dias: DiaDelEvento[];
}

export interface DiaConCambios {
  /** Las 00:00 del día del cambio. */
  dia: number;
  eventos: EventoDelInforme[];
}

export interface PlanDelInforme {
  id: string;
  nombre: string;
  tipo: string;
  desde: number;
  /** Hasta cuándo estuvo (el siguiente plan). null: es el de ahora. */
  hasta: number | null;
  dias: { nombre: string; descanso: boolean; ejercicios: { nombre: string; cuanto: string }[]; sesiones: number }[];
  /** Entrenos de días que ya no están en el plan (renombrados o quitados). */
  otros: { nombre: string; sesiones: number }[];
  sesiones: number;
}

export interface InformeDeCambios {
  desde: number;
  hasta: number;
  sesiones: number;
  planes: PlanDelInforme[];
  dias: DiaConCambios[];
  /** Cambios contados de uno en uno (cada línea que no es contenido). */
  cambios: number;
  /** Algo sale de los entrenos (para explicarlo al pie). */
  conEntrenos: boolean;
}

export interface DatosDelInforme {
  desde: number;
  hasta: number;
  routines: Routine[];
  avisos: AvisoDelPlan[];
  cycles: TrainingCycle[];
  logs: WorkoutLog[];
  /** exerciseId de la biblioteca → medida, para escribir "3 × 30 s". */
  medidas?: Record<string, string | undefined>;
  opciones?: OpcionesDelInforme;
}

/* ------------------------------------------------------------------ */
/* Cómo se llaman las cosas                                            */
/* ------------------------------------------------------------------ */

export function tipoDePlan(r: Pick<Routine, 'schedule' | 'scheduleLabel'>): string {
  switch (r.schedule ?? 'weekly') {
    case 'cycle':
      return t('Días sueltos');
    case 'flex':
      return t(flexLabel(r.scheduleLabel, 'Personalizado'));
    case 'gtg':
      return t('Grease the groove');
    default:
      return t('Semanal');
  }
}

function nombreDeDiaDelPlan(r: Routine, d: RoutineDay, i: number): string {
  const nombre = nombreDelDia(d.name, i);
  if ((r.schedule ?? 'weekly') === 'weekly' && typeof d.weekday === 'number' && WEEKDAY_NAMES[d.weekday]) {
    const semana = t(WEEKDAY_NAMES[d.weekday]);
    return nombre.toLowerCase() === semana.toLowerCase() ? semana : `${semana} · ${nombre}`;
  }
  if ((r.schedule ?? 'weekly') === 'cycle') {
    const numero = frase`Día ${i + 1}`;
    return nombre.toLowerCase() === numero.toLowerCase() ? numero : `${numero} · ${nombre}`;
  }
  return nombre;
}

const etiquetas = (claves: string[] | undefined, de: Record<string, string>) =>
  (claves ?? []).map((k, i) => {
    const s = t(de[k] ?? de.otros ?? k);
    return i === 0 ? s : s.toLowerCase();
  });

/* ------------------------------------------------------------------ */
/* Los planes                                                          */
/* ------------------------------------------------------------------ */

function planesDelPeriodo(
  routines: Routine[],
  logs: WorkoutLog[],
  desde: number,
  hasta: number,
  medidaDe: (exerciseId: string) => ExerciseMeasure | undefined
): PlanDelInforme[] {
  const ordenadas = [...routines].sort((a, b) => a.createdAt - b.createdAt);
  return ordenadas
    .map((r, i) => {
      const siguiente = ordenadas[i + 1];
      const fin = r.active ? null : (siguiente?.createdAt ?? r.updatedAt);
      return { r, inicio: r.createdAt, fin };
    })
    .filter(({ inicio, fin }) => inicio <= hasta && (fin === null || fin >= desde))
    .map(({ r, inicio, fin }) => {
      // Un entreno es de este plan si lo dice; si no lo dice (los muy antiguos),
      // si se hizo mientras este plan era el vigente.
      const esDeEste = (l: WorkoutLog) =>
        l.routineId ? l.routineId === r.id : l.date >= inicio && (fin === null || l.date < fin);
      const suyos = logs.filter((l) => esDeEste(l) && l.date >= desde && l.date <= hasta);
      const porDia = new Map<string, number>();
      for (const l of suyos) porDia.set(l.dayName, (porDia.get(l.dayName) ?? 0) + 1);
      const conocidos = new Set<string>();
      const dias = r.days.map((d, i) => {
        conocidos.add(d.name);
        return {
          nombre: nombreDeDiaDelPlan(r, d, i),
          descanso: !!d.isRest,
          ejercicios: d.exercises.map((e) => ({ nombre: e.name, cuanto: cuantoDelEjercicio(e, medidaDe(e.exerciseId)) })),
          sesiones: porDia.get(d.name) ?? 0,
        };
      });
      const otros = [...porDia.entries()]
        .filter(([nombre]) => !conocidos.has(nombre))
        .map(([nombre, sesiones]) => ({ nombre, sesiones }));
      return {
        id: r.id,
        nombre: r.name,
        tipo: tipoDePlan(r),
        desde: inicio,
        hasta: fin,
        dias,
        otros,
        sesiones: suyos.length,
      };
    });
}

/* ------------------------------------------------------------------ */
/* Los cambios del registro                                            */
/* ------------------------------------------------------------------ */

function eventoDelAviso(a: AvisoDelPlan, o: OpcionesDelInforme): EventoDelInforme | null {
  const dias: DiaDelEvento[] = [];
  for (const d of a.dias) {
    const lineas: LineaDelInforme[] = [];
    const contenido = () =>
      d.ejercicios.forEach((e) => lineas.push({ tipo: 'contenido', texto: `${e.nombre} · ${e.cuanto}` }));
    if (a.nuevo) {
      if (o.rutina) contenido();
    } else if (d.estado === 'nuevo') {
      if (o.rutina) {
        lineas.push({ tipo: 'dia', texto: t('Día nuevo') });
        contenido();
      }
    } else if (d.estado === 'quitado') {
      if (o.rutina) lineas.push({ tipo: 'dia', texto: t('Día quitado del plan') });
    } else {
      if (o.rutina && d.que?.length) {
        lineas.push({ tipo: 'dia', texto: etiquetas(d.que, ETIQUETA_DEL_DIA).join(', ') });
      }
      for (const e of d.ejercicios) {
        if (e.estado === 'nuevo') {
          if (o.ejercicios) lineas.push({ tipo: 'nuevo', texto: `${e.nombre} · ${e.cuanto}` });
          continue;
        }
        if (e.estado !== 'cambiado') continue;
        if (e.antesNombre && o.ejercicios) lineas.push({ tipo: 'sustituido', texto: `${e.antesNombre} → ${e.nombre}` });
        if (e.antes && o.series) lineas.push({ tipo: 'series', texto: `${e.nombre}: ${e.antes} → ${e.cuanto}` });
        if (e.que?.length && o.detalles) {
          lineas.push({ tipo: 'detalle', texto: `${e.nombre}: ${etiquetas(e.que, ETIQUETA_DEL_EJERCICIO).join(', ')}` });
        }
      }
      if (o.ejercicios) for (const q of d.quitados ?? []) lineas.push({ tipo: 'quitado', texto: q });
    }
    if (lineas.length > 0) dias.push({ nombre: nombreDelDiaDelAviso(d), lineas });
  }
  const notas = o.rutina && a.ajustes?.length ? [frase`Ajustes del plan: ${etiquetas(a.ajustes, ETIQUETA_DEL_PLAN).join(', ')}`] : [];
  if (dias.length === 0 && notas.length === 0 && !(a.nuevo && o.rutina)) return null;
  return {
    cuando: a.cuando,
    fuente: a.nuevo ? 'plan-nuevo' : 'cambio',
    titulo: a.nuevo ? frase`Plan nuevo: ${a.plan}` : frase`Cambios en ${a.plan}`,
    notas,
    dias,
  };
}

/** Un plan que empezó antes del registro (o sin aviso): se sabe cuándo, no cómo era entonces. */
function eventoDePlanNuevo(r: Routine): EventoDelInforme {
  const dias = r.days.filter((d) => !d.isRest).map((d, i) => nombreDelDia(d.name, i));
  return {
    cuando: r.createdAt,
    fuente: 'plan-nuevo',
    titulo: frase`Plan nuevo: ${r.name}`,
    notas: [unidoConPunto([tipoDePlan(r), dias.length === 1 ? t('1 día de entreno') : frase`${dias.length} días de entreno`, dias.join(', ')])],
    dias: [],
  };
}

const unidoConPunto = (partes: string[]) => partes.filter(Boolean).join(' · ');

/* ------------------------------------------------------------------ */
/* Los ciclos                                                          */
/* ------------------------------------------------------------------ */

function eventosDeCiclos(
  cycles: TrainingCycle[],
  nombres: Map<string, string>,
  desde: number,
  hasta: number
): EventoDelInforme[] {
  const porId = new Map(cycles.map((c) => [c.id, c]));
  const eventos: EventoDelInforme[] = [];
  for (const c of cycles) {
    if (typeof c.startDate !== 'number' || c.startDate < desde || c.startDate > hasta) continue;
    const padre = c.parentId ? porId.get(c.parentId) : undefined;
    if (c.level === 'micro') {
      const lineas: LineaDelInforme[] = [];
      if (c.isDeload) lineas.push({ tipo: 'dia', texto: t('Semana de descarga') });
      for (const e of c.weekPlan ?? []) {
        const nombre = nombres.get(e.exerciseId) ?? t('Ejercicio');
        const partes = [
          e.sets && e.reps ? `${e.sets} × ${e.reps}` : e.sets ? frase`${e.sets} series` : e.reps ? frase`${e.reps} reps` : '',
          typeof e.rir === 'number' ? `RIR ${e.rir}` : '',
        ].filter(Boolean);
        if (partes.length > 0) lineas.push({ tipo: 'series', texto: `${nombre}: ${partes.join(' · ')}` });
      }
      if (lineas.length === 0) continue;
      eventos.push({
        cuando: c.startDate,
        fuente: 'ciclo',
        titulo: padre ? `${c.name} · ${padre.name}` : c.name,
        notas: [],
        dias: [{ nombre: t('Lo programado esa semana'), lineas }],
      });
    } else {
      eventos.push({
        cuando: c.startDate,
        fuente: 'ciclo',
        titulo: frase`Empieza el bloque: ${c.name}`,
        notas: c.goal ? [frase`Objetivo: ${c.goal}`] : [],
        dias: [],
      });
    }
  }
  return eventos;
}

/* ------------------------------------------------------------------ */
/* Lo que se ve en los entrenos (antes del registro)                   */
/* ------------------------------------------------------------------ */

interface Composicion {
  fecha: number;
  ejercicios: Map<string, { nombre: string; series: number }>;
}

function composicion(l: WorkoutLog): Composicion {
  const ejercicios = new Map<string, { nombre: string; series: number }>();
  for (const e of l.exercises) {
    const previo = ejercicios.get(e.exerciseId);
    // El mismo ejercicio dos veces en un día (una superserie fusionada): se suman.
    ejercicios.set(e.exerciseId, { nombre: e.name, series: (previo?.series ?? 0) + e.sets.length });
  }
  return { fecha: l.date, ejercicios };
}

/**
 * Los cambios que se ven sesión a sesión en cada tipo de día: ejercicios que
 * entran o salen y número de series.
 *
 * Se compara con lo ESTABLECIDO, no con la sesión de antes, y un cambio solo
 * cuenta si la sesión siguiente lo confirma. Así un día raro no es un cambio:
 * se saltó los Fondos (y al siguiente volvieron), hizo una serie de más. Y la
 * vuelta de los Fondos tampoco es "un ejercicio nuevo": nunca se fueron.
 *
 * Con `hasta` se dice hasta cuándo se APUNTAN cambios; para confirmar se mira
 * la sesión siguiente aunque caiga después.
 */
export function cambiosVistosEnLosEntrenos(
  logs: WorkoutLog[],
  desde: number,
  hasta: number,
  o: Pick<OpcionesDelInforme, 'ejercicios' | 'series'>
): EventoDelInforme[] {
  if (!o.ejercicios && !o.series) return [];
  const porTipo = new Map<string, WorkoutLog[]>();
  for (const l of logs) {
    if (l.gtg) continue; // el grease the groove se apunta serie a serie: no es una sesión.
    const clave = `${l.routineId}|${l.dayName}`;
    porTipo.set(clave, [...(porTipo.get(clave) ?? []), l]);
  }
  const eventos: EventoDelInforme[] = [];
  for (const sesiones of porTipo.values()) {
    sesiones.sort((a, b) => a.date - b.date);
    const orden = sesiones.map(composicion);
    if (orden.length === 0) continue;
    // Lo establecido: empieza con la primera sesión y solo cambia con cambios confirmados.
    const establecido = new Map(orden[0].ejercicios);
    for (let i = 1; i < orden.length - 1; i++) {
      const fecha = orden[i].fecha;
      const ahora = orden[i].ejercicios;
      const despues = orden[i + 1].ejercicios;
      const lineas: LineaDelInforme[] = [];
      for (const [id, e] of ahora) {
        if (establecido.has(id) || !despues.has(id)) continue;
        establecido.set(id, e);
        if (o.ejercicios) {
          lineas.push({ tipo: 'nuevo', texto: e.series === 1 ? frase`${e.nombre} · 1 serie` : frase`${e.nombre} · ${e.series} series` });
        }
      }
      for (const [id, e] of [...establecido]) {
        if (ahora.has(id) || despues.has(id)) continue;
        establecido.delete(id);
        if (o.ejercicios) lineas.push({ tipo: 'quitado', texto: e.nombre });
      }
      for (const [id, e] of ahora) {
        const antes = establecido.get(id);
        if (!antes || antes.series === e.series || e.series === 0) continue;
        if (despues.get(id)?.series !== e.series) continue;
        establecido.set(id, e);
        if (o.series) lineas.push({ tipo: 'series', texto: frase`${e.nombre}: ${antes.series} → ${e.series} series` });
      }
      if (lineas.length === 0 || fecha < desde || fecha > hasta) continue;
      const log = sesiones[i];
      eventos.push({
        cuando: fecha,
        fuente: 'entrenos',
        titulo: log.routineName ? frase`Visto en sus entrenos · ${log.routineName}` : t('Visto en sus entrenos'),
        notas: [],
        dias: [{ nombre: log.dayName, lineas }],
      });
    }
  }
  return eventos;
}

/* ------------------------------------------------------------------ */
/* Todo junto                                                          */
/* ------------------------------------------------------------------ */

export function informeDeCambios(d: DatosDelInforme): InformeDeCambios {
  const o = d.opciones ?? TODO_EL_INFORME;
  const { desde, hasta } = d;
  const medidaDe = (exerciseId: string) => d.medidas?.[exerciseId] as ExerciseMeasure | undefined;
  const enPeriodo = (ts: number) => ts >= desde && ts <= hasta;

  const eventos: EventoDelInforme[] = [];

  // Del registro: lo exacto.
  for (const a of d.avisos) {
    if (!enPeriodo(a.cuando)) continue;
    const e = eventoDelAviso(a, o);
    if (e) eventos.push(e);
  }

  // Los planes que empezaron sin aviso (antes del registro): cuándo, y qué días.
  if (o.rutina) {
    const conAviso = new Set(d.avisos.filter((a) => a.nuevo).map((a) => a.routineId));
    for (const r of d.routines) {
      if (enPeriodo(r.createdAt) && !conAviso.has(r.id)) eventos.push(eventoDePlanNuevo(r));
    }
  }

  // Los ciclos: bloques y lo programado cada semana.
  if (o.semanas) {
    const nombres = new Map<string, string>();
    for (const r of d.routines) for (const dia of r.days) for (const e of dia.exercises) if (!nombres.has(e.exerciseId)) nombres.set(e.exerciseId, e.name);
    eventos.push(...eventosDeCiclos(d.cycles, nombres, desde, hasta));
  }

  // Antes del registro, lo que se ve en los entrenos (confirmado con la sesión
  // siguiente, aunque esa ya sea de después).
  const deEntrenos = cambiosVistosEnLosEntrenos(d.logs, desde, Math.min(hasta, INICIO_DEL_REGISTRO - 1), o);
  eventos.push(...deEntrenos);

  // Por día del cambio, del más antiguo al más nuevo: es una historia.
  const porDia = new Map<number, EventoDelInforme[]>();
  for (const e of eventos.sort((a, b) => a.cuando - b.cuando)) {
    const dia = inicioDelDia(e.cuando);
    porDia.set(dia, [...(porDia.get(dia) ?? []), e]);
  }
  const dias = [...porDia.entries()].sort((a, b) => a[0] - b[0]).map(([dia, ev]) => ({ dia, eventos: ev }));
  const cambios = eventos.reduce(
    (n, e) => n + e.notas.length + e.dias.reduce((m, x) => m + x.lineas.filter((l) => l.tipo !== 'contenido').length, 0),
    0
  );

  return {
    desde,
    hasta,
    sesiones: d.logs.filter((l) => enPeriodo(l.date)).length,
    planes: o.planes ? planesDelPeriodo(d.routines, d.logs, desde, hasta, medidaDe) : [],
    dias,
    cambios,
    conEntrenos: deEntrenos.length > 0,
  };
}

/** Desde cuándo entrena con él: lo primero que hay (cuenta, plan o entreno). */
export function inicioDelAlumno(fechas: (number | undefined)[]): number {
  const validas = fechas.filter((f): f is number => typeof f === 'number' && f > 0);
  return inicioDelDia(validas.length > 0 ? Math.min(...validas) : Date.now());
}
