import { DIAS_ATRAS } from './registroTardio';
import { isHoldMeasure, resolveLoad } from './types';
import type {
  Exercise,
  ExerciseLoad,
  ExerciseMeasure,
  LoggedExercise,
  Routine,
  RoutineDay,
} from './types';

/**
 * Contarle el entreno a la app hablando.
 *
 * Registrar a mano un entreno de hace dos días son treinta toques: elegir el
 * día, elegir el entreno, ajustar las series de cada ejercicio y escribir marca
 * por marca. Contarlo en voz alta son diez segundos: "ayer hice cuatro series
 * de dominadas, ocho, siete, seis y cinco, y fondos con diez kilos, tres de
 * ocho". La diferencia entre esas dos cosas es la diferencia entre que el
 * entreno se apunte y que se pierda.
 *
 * El reparto es este: el móvil pasa la voz a texto (el dictado del teclado en
 * el móvil, el del navegador en el ordenador) y la IA convierte ese texto en
 * marcas. La IA no oye audio; lee. Y no se le pide que adivine: se le manda la
 * lista exacta de ejercicios que esa persona tiene, con su medida y su carga,
 * y solo puede elegir de ahí. Lo que no sepa colocar lo dice, en vez de
 * inventárselo.
 *
 * Nada de lo que devuelve se guarda a ciegas. Este módulo lo limpia entero
 * —ejercicios que no existen fuera, marcas imposibles, pesos en un ejercicio
 * que no lleva peso— y después se le enseña a la persona lo que se ha
 * entendido. Ella es quien confirma. Una IA que apunta cuarenta dominadas que
 * nadie hizo estropea el histórico, los récords y la confianza de golpe.
 */

/** El servidor que habla con la IA. La clave vive allí, nunca en la app. */
export const DICTADO_URL = 'https://udeca.vercel.app/api/apuntar-entreno';

/** Un ejercicio tal y como se le ofrece a la IA para que elija. */
export interface EjercicioDelCatalogo {
  id: string;
  nombre: string;
  medida: ExerciseMeasure;
  carga: ExerciseLoad;
}

/** Lo que el servidor devuelve, tal cual: sin limpiar y sin fiarse. */
export interface DictadoBruto {
  ejercicios?: { exerciseId?: unknown; series?: unknown }[];
  duracionMin?: unknown;
  haceDias?: unknown;
  sinIdentificar?: unknown;
  resumen?: unknown;
}

/** Lo mismo, ya validado y listo para tocar la pantalla. */
export interface Dictado {
  ejercicios: { id: string; series: { marca: string; peso: string }[] }[];
  /** Minutos que dijo que duró, si lo dijo. */
  duracionMin?: number;
  /** Hace cuántos días fue (0 = hoy), si lo dijo. */
  haceDias?: number;
  /** Lo que nombró y no se supo colocar. Se le enseña, no se esconde. */
  sinIdentificar: string[];
}

/** Topes de sensatez. Nadie hace treinta series de un ejercicio en un día. */
export const MAX_EJERCICIOS = 15;
export const MAX_SERIES = 20;
/** Una marca es reps o segundos; una hora de aguante no existe. */
export const MAX_MARCA = 3600;
/** Kilos de lastre. Por encima de esto es un dedo, no un lastre. */
export const MAX_PESO = 300;

/**
 * Los ejercicios entre los que la IA puede elegir.
 *
 * Van los de TODOS los días del plan, no solo los del día abierto: quien
 * registra un entreno viejo muchas veces se equivoca de día al abrir la
 * pantalla, y es el propio dictado el que dice cuál fue. Y van también los de
 * la biblioteca del entrenador, porque en un entreno pasado cabe cualquier
 * cosa que se hiciera de más.
 */
export function catalogoParaLaIA(
  routine: Routine | null | undefined,
  biblioteca: Exercise[] = []
): EjercicioDelCatalogo[] {
  const porId = new Map<string, EjercicioDelCatalogo>();
  // Primero el plan: ahí la medida y la carga son las que el entrenador puso
  // para ESE ejercicio en ESTE plan, que mandan sobre la ficha general.
  for (const dia of routine?.days ?? []) {
    for (const ex of dia.exercises ?? []) {
      if (!ex.exerciseId || porId.has(ex.exerciseId)) continue;
      porId.set(ex.exerciseId, {
        id: ex.exerciseId,
        nombre: ex.name,
        medida: ex.measure ?? 'reps',
        carga: resolveLoad(ex),
      });
    }
  }
  for (const ex of biblioteca) {
    if (!ex.id || porId.has(ex.id)) continue;
    porId.set(ex.id, {
      id: ex.id,
      nombre: ex.name,
      medida: ex.measure ?? 'reps',
      carga: resolveLoad(ex),
    });
  }
  return [...porId.values()];
}

/** Un número entero dentro de sus límites, o nada si no lo es. */
function entero(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? ''));
  if (!Number.isFinite(n)) return undefined;
  const r = Math.round(n);
  if (r < min || r > max) return undefined;
  return r;
}

/** El peso, que sí admite medios kilos, en texto y con un decimal como mucho. */
function peso(v: unknown): string {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? ''));
  if (!Number.isFinite(n) || n <= 0 || n > MAX_PESO) return '';
  return String(Math.round(n * 10) / 10);
}

/**
 * Deja el dictado en condiciones de tocar la pantalla.
 *
 * Todo lo que llega de la IA pasa por aquí: ejercicios que no están en el
 * catálogo fuera, marcas imposibles fuera, y peso solo donde el ejercicio de
 * verdad lleva peso. El cero es "no lo dijo", no "cero repeticiones": una
 * serie sin marca se apunta igual, porque el hecho de haberla hecho ya cuenta.
 */
export function limpiaDictado(
  bruto: DictadoBruto | null | undefined,
  catalogo: EjercicioDelCatalogo[]
): Dictado {
  const porId = new Map(catalogo.map((c) => [c.id, c]));
  const vistos = new Set<string>();
  const ejercicios: Dictado['ejercicios'] = [];

  for (const e of Array.isArray(bruto?.ejercicios) ? bruto.ejercicios : []) {
    if (ejercicios.length >= MAX_EJERCICIOS) break;
    const id = typeof e?.exerciseId === 'string' ? e.exerciseId : '';
    const ficha = porId.get(id);
    // Un ejercicio inventado no entra: guardaría marcas colgando de un id que
    // no existe, y eso no lo arregla ya nadie desde la pantalla.
    if (!ficha || vistos.has(id)) continue;
    const crudas = Array.isArray(e?.series) ? e.series : [];
    const series = crudas.slice(0, MAX_SERIES).map((s) => {
      const marca = entero((s as { marca?: unknown })?.marca, 1, MAX_MARCA);
      return {
        marca: marca === undefined ? '' : String(marca),
        // Un ejercicio de peso corporal no puede llevar kilos por mucho que se
        // haya dicho: la casilla ni siquiera existe en pantalla.
        peso: ficha.carga === 'none' ? '' : peso((s as { peso?: unknown })?.peso),
      };
    });
    if (series.length === 0) continue;
    vistos.add(id);
    ejercicios.push({ id, series });
  }

  const sinIdentificar = (Array.isArray(bruto?.sinIdentificar) ? bruto.sinIdentificar : [])
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 8);

  return {
    ejercicios,
    duracionMin: entero(bruto?.duracionMin, 1, 12 * 60),
    haceDias: entero(bruto?.haceDias, 0, DIAS_ATRAS - 1),
    sinIdentificar,
  };
}

/** ¿Ha entendido algo que merezca la pena apuntar? */
export function hayDictado(d: Dictado | null | undefined): boolean {
  return !!d && d.ejercicios.length > 0;
}

/**
 * El dictado convertido en el entreno que se va a guardar.
 *
 * Lo dictado MANDA: lo que sale es exactamente lo que se ha contado, ni un
 * ejercicio más. Conservar los del plan que no se nombraron parece amable y es
 * justo lo contrario: dejaría apuntadas series que nadie hizo, con sus marcas
 * precargadas, y eso infla el volumen, la racha y los récords.
 */
export function aLog(dictado: Dictado, catalogo: EjercicioDelCatalogo[]): LoggedExercise[] {
  const porId = new Map(catalogo.map((c) => [c.id, c]));
  const salida: LoggedExercise[] = [];
  for (const ex of dictado.ejercicios) {
    const ficha = porId.get(ex.id);
    if (!ficha) continue;
    salida.push({
      exerciseId: ficha.id,
      name: ficha.nombre,
      measure: ficha.medida,
      load: ficha.carga,
      sets: ex.series.map((s) => ({
        reps: s.marca,
        weight: s.peso,
        // Se está contando algo que YA se hizo: nace hecha.
        completed: true,
      })),
    });
  }
  return salida;
}

/**
 * De qué día del plan suena esto.
 *
 * Se decide contando: gana el día que más ejercicios comparte con lo dictado.
 * No es adivinar, es que el nombre del entreno tiene que salir de algún sitio
 * y los ejercicios que se han dicho son la mejor pista que hay. En empate, o
 * si no coincide nada, se queda el que ya estaba elegido: la persona lo ve en
 * pantalla y lo cambia de un toque.
 */
export function diaMasProbable(
  dictado: Dictado,
  routine: Routine | null | undefined,
  actual: RoutineDay | null | undefined
): RoutineDay | null {
  const dichos = new Set(dictado.ejercicios.map((e) => e.id));
  if (dichos.size === 0) return actual ?? null;
  let mejor: RoutineDay | null = null;
  let mejorCuantos = 0;
  for (const dia of routine?.days ?? []) {
    if (dia.isRest) continue;
    const cuantos = (dia.exercises ?? []).filter((e) => dichos.has(e.exerciseId)).length;
    if (cuantos > mejorCuantos) {
      mejorCuantos = cuantos;
      mejor = dia;
    }
  }
  return mejorCuantos > 0 ? mejor : (actual ?? null);
}

/** La unidad con la que se enseña una marca: segundos si es aguante. */
function unidad(medida: ExerciseMeasure): string {
  return isHoldMeasure(medida) ? 's' : '';
}

/**
 * Lo entendido, en una línea por ejercicio, para enseñárselo antes de apuntar.
 *
 * Este paso no es un adorno: es el único sitio donde se puede pillar que la IA
 * ha oído "quince" donde se dijo "cincuenta". Leer una línea cuesta un segundo
 * y ahorra tener que deshacer un entreno entero.
 */
export function resumenDelDictado(dictado: Dictado, catalogo: EjercicioDelCatalogo[]): string[] {
  const porId = new Map(catalogo.map((c) => [c.id, c]));
  return dictado.ejercicios.map((ex) => {
    const ficha = porId.get(ex.id);
    const nombre = ficha?.nombre ?? 'Ejercicio';
    const u = unidad(ficha?.medida ?? 'reps');
    const marcas = ex.series
      .map((s) => {
        const base = s.marca ? `${s.marca}${u}` : '?';
        return s.peso ? `${base} · ${s.peso} kg` : base;
      })
      .join(', ');
    return `${nombre}: ${marcas}`;
  });
}

/** Cuántas series en total, para el botón y para el aviso de "no he pillado nada". */
export function cuantasSeries(dictado: Dictado): number {
  return dictado.ejercicios.reduce((n, e) => n + e.series.length, 0);
}
