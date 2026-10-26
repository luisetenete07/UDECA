import { esMismoDia } from './fechas';
import { frase } from './idioma';
import type { DiaDeRutinaDiaria, EjercicioDiario, MargenDeMinutos, RutinaDiaria } from './types';

/**
 * La rutina diaria: cuánto llevas hoy y qué se te dice.
 *
 * Aquí no se importa nada de la app —ni React Native ni Firebase— para poder
 * comprobar estas cuentas en Node pelado. Lo que decide si alguien ve su rutina
 * y si la da por hecha no puede quedarse sin probar.
 */

/** Nombre por omisión, si el entrenador no le pone uno. */
export const NOMBRE_POR_DEFECTO = 'Tu rutina diaria';

/** ¿Se le enseña algo al alumno? */
export function hayRutinaDiaria(r: RutinaDiaria | null | undefined): boolean {
  return !!r && r.activa && r.ejercicios.length > 0;
}

/** Lo hecho HOY, o nada si el registro es de otro día. */
export function hechosDeHoy(
  dia: DiaDeRutinaDiaria | null | undefined,
  ahora = Date.now()
): string[] {
  if (!dia || !esMismoDia(dia.date, ahora)) return [];
  return dia.hechos ?? [];
}

/**
 * Lo que se marca hoy: una casilla por SERIE, o una por ejercicio.
 *
 * En el grease the groove las series no van seguidas: se reparten por el día.
 * Por eso, cuando el entrenador pone un número, cada serie se marca por su
 * cuenta y el alumno sabe cuántas le quedan. Sin número no hay nada que contar
 * y el ejercicio se marca entero de un toque, como siempre.
 *
 * La marca de una serie es `id#n`. Con la almohadilla porque los identificadores
 * de ejercicio se generan sin ella, así que no puede chocar con uno de verdad.
 */
export function marcaDeSerie(id: string, serie: number): string {
  return `${id}#${serie}`;
}

/** Todas las marcas que existen hoy, en orden. Nada fuera de esta lista cuenta. */
export function marcasDeLaRutina(
  r: RutinaDiaria | null | undefined,
  dia?: DiaDeRutinaDiaria | null,
  ahora = Date.now()
): string[] {
  const salida: string[] = [];
  for (const e of r?.ejercicios ?? []) {
    const n = seriesDelDia(e, dia, ahora);
    if (n <= 1) salida.push(e.id);
    else for (let i = 1; i <= n; i++) salida.push(marcaDeSerie(e.id, i));
  }
  return salida;
}

/**
 * Cuántas series tiene un ejercicio a efectos de contar.
 *
 * Sin número, una: se marca entero. Un número absurdo no se cree —guardar 900
 * series es un dedo que resbaló en el teclado, no una intención—.
 */
export function seriesDe(e: { series?: number }): number {
  const n = e.series;
  if (typeof n !== 'number' || !Number.isFinite(n)) return 1;
  return Math.min(MAX_SERIES, Math.max(1, Math.floor(n)));
}

/** El tope. Más que esto no es una rutina diaria, es otra cosa. */
export const MAX_SERIES = 30;

/**
 * ¿Se cuenta por series? Solo si el entrenador puso un número: son los que el
 * alumno puede subir o bajar. Dos minutos de movilidad no tienen series que
 * añadir.
 */
export function cuentaSeries(e: { series?: number }): boolean {
  return typeof e.series === 'number' && e.series > 0;
}

/**
 * Las series de HOY de un ejercicio: las que el alumno haya puesto para hoy o,
 * si no ha tocado nada, las del entrenador. Lo de ayer no cuenta.
 */
export function seriesDelDia(
  e: EjercicioDiario,
  dia?: DiaDeRutinaDiaria | null,
  ahora = Date.now()
): number {
  // Por tiempo es una sola cosa que hacer, aunque hoy hubiera tocado series
  // antes de que el entrenador lo cambiara a minutos.
  if (cuentaTiempo(e)) return 1;
  const propias = dia && esMismoDia(dia.date, ahora) ? dia.series?.[e.id] : undefined;
  return typeof propias === 'number' ? seriesDe({ series: propias }) : seriesDe(e);
}

/**
 * EL ALUMNO AÑADE O QUITA SERIES PARA HOY.
 *
 * Hay días de hacer una más y días de hacer una menos, y en algo que se repite
 * a diario eso es lo sano, no un fallo. Lo que cambia es SOLO hoy: mañana
 * vuelven las del entrenador.
 *
 * Lo ya marcado se respeta: si llevaba tres hechas y baja a dos, quedan dos
 * hechas (y no "3 de 2"). Devuelve las series del día y lo hecho, para guardar.
 */
export function conSeriesDeHoy(
  rutina: RutinaDiaria,
  dia: DiaDeRutinaDiaria | null | undefined,
  ejercicioId: string,
  series: number,
  ahora = Date.now()
): { series: Record<string, number>; hechos: string[] } {
  const e = rutina.ejercicios.find((x) => x.id === ejercicioId);
  const deHoy = dia && esMismoDia(dia.date, ahora) ? { ...(dia.series ?? {}) } : {};
  const hechos = hechosDeHoy(dia, ahora);
  if (!e) return { series: deHoy, hechos };
  const nuevo = Math.min(MAX_SERIES, Math.max(1, Math.floor(series)));
  const suyas = (m: string) => m === e.id || m.startsWith(`${e.id}#`);
  const hechasAqui = hechos.filter(suyas).length;
  const marcas = nuevo <= 1 ? [e.id] : Array.from({ length: nuevo }, (_, i) => marcaDeSerie(e.id, i + 1));
  if (nuevo === seriesDe(e)) delete deHoy[e.id];
  else deHoy[e.id] = nuevo;
  return {
    series: deHoy,
    hechos: [...hechos.filter((m) => !suyas(m)), ...marcas.slice(0, Math.min(hechasAqui, nuevo))],
  };
}

/**
 * Lee el número de series que se escribe en el editor.
 *
 * Vacío devuelve `undefined` —sin poner— y no cero: son cosas distintas, y
 * guardar un cero dejaría un ejercicio que no se puede marcar nunca.
 */
export function seriesDeTexto(texto: string): number | undefined {
  const limpio = (texto ?? '').replace(/[^0-9]/g, '');
  if (!limpio) return undefined;
  const n = Number.parseInt(limpio, 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(MAX_SERIES, n);
}

/*
 * POR TIEMPO EN VEZ DE POR SERIES: "20-30 MIN DE PINO".
 *
 * Hay cosas que se programan por rato de práctica y no por series: veinte o
 * treinta minutos de pino, repartidos como salgan. El alumno va sumando
 * minutos a lo largo del día (+5, +10) y, al llegar al mínimo, el ejercicio se
 * da por hecho solo. Pasarse del máximo no se celebra: en algo que se repite a
 * diario, el máximo está para no quemarse.
 */

/** El tope: más de diez horas al día no es una rutina diaria, es un dedo que resbaló. */
export const MAX_MINUTOS = 600;

/** ¿Va por tiempo? Solo si el entrenador puso unos minutos de verdad. */
export function cuentaTiempo(e: { minutos?: MargenDeMinutos }): e is { minutos: MargenDeMinutos } {
  return !!e.minutos && Number.isFinite(e.minutos.min) && e.minutos.min > 0;
}

/**
 * Lee los minutos que escribe el entrenador: "20" y "30" en sus dos casillas,
 * o "20-30" en una. Vacío, nada (sin poner). Al revés ("30" y "20") se ordena,
 * y un margen de 20 a 20 es un tiempo fijo de 20.
 */
export function minutosDeTexto(desde: string, hasta = ''): MargenDeMinutos | undefined {
  const numeros = `${desde ?? ''} ${hasta ?? ''}`
    .match(/\d+/g)
    ?.map((n) => Math.min(MAX_MINUTOS, Number.parseInt(n, 10)))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 2);
  if (!numeros?.length) return undefined;
  const min = Math.min(...numeros);
  const max = Math.max(...numeros);
  return max > min ? { min, max } : { min };
}

/** "20-30 min" o "20 min". */
export function textoDeMinutos(m: MargenDeMinutos): string {
  return m.max && m.max > m.min ? frase`${m.min}-${m.max} min` : frase`${m.min} min`;
}

/** Los minutos que lleva HOY de un ejercicio. Los de ayer no cuentan. */
export function minutosDeHoy(
  e: { id: string },
  dia?: DiaDeRutinaDiaria | null,
  ahora = Date.now()
): number {
  if (!dia || !esMismoDia(dia.date, ahora)) return 0;
  const n = dia.minutos?.[e.id];
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * EL ALUMNO SUMA (O CORRIGE) MINUTOS DE HOY.
 *
 * Devuelve los minutos del día y lo hecho, para guardar. Al llegar al mínimo
 * el ejercicio se marca solo; si corrige hacia abajo y deja de llegar, se
 * desmarca. Si lo marcó a mano sin llegar (lo hizo y no lo cronometró), se
 * respeta: sumar un rato más no le quita la marca.
 */
export function conMinutosDeHoy(
  rutina: RutinaDiaria,
  dia: DiaDeRutinaDiaria | null | undefined,
  ejercicioId: string,
  minutos: number,
  ahora = Date.now()
): { minutos: Record<string, number>; hechos: string[] } {
  const e = rutina.ejercicios.find((x) => x.id === ejercicioId);
  const deHoy = dia && esMismoDia(dia.date, ahora) ? { ...(dia.minutos ?? {}) } : {};
  const hechos = hechosDeHoy(dia, ahora);
  if (!e || !cuentaTiempo(e)) return { minutos: deHoy, hechos };
  const antes = minutosDeHoy(e, dia, ahora);
  // Al segundo: con el crono, 7 min y 40 s son eso, no 8.
  const nuevo = Math.min(MAX_MINUTOS, Math.max(0, Math.round(minutos * 60) / 60));
  if (nuevo > 0) deHoy[e.id] = nuevo;
  else delete deHoy[e.id];
  const llega = nuevo >= e.minutos.min;
  const llegaba = antes >= e.minutos.min;
  if (llega) return { minutos: deHoy, hechos: conMarca(hechos, e.id, true) };
  if (llegaba) return { minutos: deHoy, hechos: conMarca(hechos, e.id, false) };
  return { minutos: deHoy, hechos };
}

/*
 * EL CRONO: SE PULSA "EMPEZAR" Y SE MIDE EL RATO DE VERDAD.
 *
 * Para lo que va por tiempo, el alumno no tiene que calcular cuánto ha
 * estado: pulsa Empezar, practica y pulsa Parar; ese rato se suma a lo de hoy.
 * El crono guarda CUÁNDO empezó, no cuánto lleva: así sigue bien aunque el
 * móvil se bloquee, se cambie de app o se cierre y se vuelva a abrir.
 */

/** Una tanda de crono no suma más de esto: uno olvidado no se come la tarde. */
export const MAX_TANDA_MIN = 120;

/** El crono que está corriendo: de qué ejercicio, de quién y desde cuándo. */
export interface CronoDiario {
  uid: string;
  id: string;
  desde: number;
}

/** Los minutos (con sus segundos) que lleva el crono, sin pasar del tope. */
export function minutosDelCrono(desde: number, ahora = Date.now()): number {
  const segundos = Math.max(0, Math.floor((ahora - desde) / 1000));
  return Math.min(MAX_TANDA_MIN * 60, segundos) / 60;
}

/**
 * ¿Sirve el crono que se quedó guardado? Solo si es de este alumno, empezó
 * HOY y su ejercicio sigue en la rutina yendo por tiempo. Uno de ayer no se
 * suma a hoy: se tira.
 */
export function cronoVigente(
  crono: CronoDiario | null | undefined,
  uid: string,
  rutina: RutinaDiaria | null | undefined,
  ahora = Date.now()
): CronoDiario | null {
  if (!crono || crono.uid !== uid || !Number.isFinite(crono.desde) || crono.desde > ahora) return null;
  if (!esMismoDia(crono.desde, ahora)) return null;
  const e = rutina?.ejercicios.find((x) => x.id === crono.id);
  return e && cuentaTiempo(e) ? crono : null;
}

/** "3:07" o "1:02:15": lo que marca el crono. */
export function textoDelCrono(minutos: number): string {
  const total = Math.max(0, Math.floor(minutos * 60));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Lo que lleva hoy, en minutos enteros para leerlo ("12 de 20-30 min"). */
export function minutosEnteros(minutos: number): number {
  return Math.floor(minutos + 1e-9);
}

/** Lo que hace falta de un ejercicio de la biblioteca para traérselo. */
export interface EjercicioDeBiblioteca {
  id: string;
  name: string;
  videoUrl?: string;
}

/**
 * Trae un ejercicio de la biblioteca a la rutina diaria, con lo que ya tiene.
 *
 * POR QUÉ EXISTE
 *
 * Antes, para poner el pino en la rutina diaria de un alumno había que escribir
 * "Pino contra pared" y pegar el enlace del vídeo a mano. Otra vez. Y para el
 * siguiente alumno, otra vez. El ejercicio ya existía en la biblioteca del
 * entrenador, con su nombre y su vídeo, y no había forma de decir "ese".
 *
 * SE COPIA EL NOMBRE Y EL VÍDEO, Y SE GUARDA DE DÓNDE SALIÓ
 *
 * La copia es lo que hace que el alumno vea su rutina de un tirón, leyendo un
 * solo documento y sin pedir la biblioteca de su entrenador. Y `exerciseId` es
 * lo que permite que, al corregir el ejercicio en la biblioteca, la corrección
 * llegue hasta aquí (ver lib/firestore/renombrarEjercicio.ts): sin él, una
 * falta de ortografía arreglada en la biblioteca se quedaría para siempre en la
 * rutina diaria de quien ya lo tuviera puesto.
 *
 * El objetivo y las series NO vienen de la biblioteca a propósito: son de este
 * alumno y de este momento —"30 s por lado", "5 series repartidas"—, no del
 * ejercicio.
 */
export function deLaBiblioteca(
  ejercicio: EjercicioDeBiblioteca,
  id: string,
  extra?: { objetivo?: string; series?: number; minutos?: MargenDeMinutos }
): EjercicioDiario {
  const video = ejercicio.videoUrl?.trim();
  return {
    id,
    exerciseId: ejercicio.id,
    nombre: ejercicio.name.trim(),
    objetivo: extra?.objetivo?.trim() ?? '',
    // Una cosa u otra: con minutos, las series no se guardan.
    ...(extra?.minutos ? { minutos: extra.minutos } : extra?.series ? { series: extra.series } : {}),
    ...(video ? { video } : {}),
  };
}

/**
 * ¿Está ya puesto este ejercicio de la biblioteca?
 *
 * Poner dos veces el mismo pino no es un error que la app deba impedir —hay
 * quien programa el mismo ejercicio dos veces con objetivos distintos— pero sí
 * merece avisarse, que casi siempre es un despiste.
 */
export function yaEstaPuesto(ejercicios: EjercicioDiario[], exerciseId: string): boolean {
  return ejercicios.some((e) => e.exerciseId === exerciseId);
}

/**
 * La lista con el nombre y el vídeo nuevos de un ejercicio de la biblioteca.
 *
 * Devuelve `null` cuando no cambia nada, para que quien llama no escriba en
 * Firestore por gusto: un entrenador con cuarenta alumnos que corrige una falta
 * en un ejercicio que solo usan tres no puede pagar cuarenta escrituras.
 *
 * El vídeo se borra si en la biblioteca se ha quitado: dejar el viejo sería
 * enseñar una técnica que el entrenador ha retirado a propósito.
 */
export function ejerciciosActualizados(
  ejercicios: EjercicioDiario[] | undefined,
  exerciseId: string,
  cambios: { nombre?: string; video?: string }
): EjercicioDiario[] | null {
  if (!ejercicios?.length || !exerciseId) return null;
  let tocado = false;
  const salida = ejercicios.map((e) => {
    if (e.exerciseId !== exerciseId) return e;
    const nombre = cambios.nombre?.trim() || e.nombre;
    const video = cambios.video?.trim();
    const siguiente: EjercicioDiario = { ...e, nombre };
    if (cambios.video !== undefined) {
      if (video) siguiente.video = video;
      else delete siguiente.video;
    }
    if (siguiente.nombre !== e.nombre || siguiente.video !== e.video) tocado = true;
    return siguiente;
  });
  return tocado ? salida : null;
}

/**
 * Cambia un ejercicio de sitio en la lista.
 *
 * El orden importa y no es decorativo: quien pone el pino primero y la
 * movilidad después lo hace porque quiere que se haga en ese orden, con las
 * muñecas calientes antes de cargarlas.
 */
export function moverEjercicio(
  lista: EjercicioDiario[],
  desde: number,
  hasta: number
): EjercicioDiario[] {
  if (desde === hasta) return lista;
  if (desde < 0 || hasta < 0 || desde >= lista.length || hasta >= lista.length) return lista;
  const copia = [...lista];
  const [movido] = copia.splice(desde, 1);
  copia.splice(hasta, 0, movido);
  return copia;
}

/**
 * La línea que acompaña al nombre del ejercicio: las series (o los minutos) y
 * el objetivo.
 *
 * Vive aquí y no en cada pantalla porque la escriben dos —el editor del
 * entrenador y la tarjeta del alumno— y tienen que decir lo mismo.
 */
export function textoDelEjercicio(e: EjercicioDiario): string {
  const partes: string[] = [];
  if (cuentaTiempo(e)) {
    partes.push(textoDeMinutos(e.minutos));
  } else if (typeof e.series === 'number' && e.series > 0) {
    const n = seriesDe(e);
    partes.push(n === 1 ? frase`1 serie` : frase`${n} series`);
  }
  if (e.objetivo?.trim()) partes.push(e.objetivo.trim());
  return partes.join(' · ');
}

export interface ProgresoDiario {
  hechos: number;
  total: number;
  /** 0..1. Con la rutina vacía, 0 y no una división entre cero. */
  ratio: number;
  completa: boolean;
  quedan: number;
}

export function progresoDiario(
  rutina: RutinaDiaria | null | undefined,
  dia: DiaDeRutinaDiaria | null | undefined,
  ahora = Date.now()
): ProgresoDiario {
  /*
   * Se cuentan MARCAS, no ejercicios: tres ejercicios de los que uno lleva
   * cinco series son siete cosas que hacer, no tres.
   *
   * Y solo las que SIGUEN existiendo. Si el entrenador quita el pino a media
   * semana, o le baja las series de cinco a tres, lo marcado de más deja de
   * contar: se vería "4 de 3 hechas", que es la clase de número que hace
   * desconfiar de todo lo demás que dice la pantalla.
   */
  const vivas = new Set(marcasDeLaRutina(rutina, dia, ahora));
  const total = vivas.size;
  const hechos = hechosDeHoy(dia, ahora).filter((m) => vivas.has(m)).length;
  return {
    hechos,
    total,
    ratio: total > 0 ? Math.min(1, hechos / total) : 0,
    completa: total > 0 && hechos >= total,
    quedan: Math.max(0, total - hechos),
  };
}

/**
 * Marca o desmarca UNA cosa, y devuelve la lista entera lista para guardar.
 *
 * "Una cosa" es un ejercicio entero o una serie suelta, según lleve número de
 * series o no. A esta función le da igual cuál de las dos: recibe la marca ya
 * hecha y la mete o la saca.
 *
 * Sin duplicados aunque se pulse dos veces seguidas: en un móvil con la pantalla
 * lenta, el doble toque es lo normal, no la excepción.
 */
export function conMarca(
  hechos: string[],
  id: string,
  marcado: boolean
): string[] {
  const sin = hechos.filter((x) => x !== id);
  return marcado ? [...sin, id] : sin;
}

/**
 * La línea que acompaña al progreso. Ni felicita de más ni riñe.
 *
 * El día a medias NO se cuenta como fallo: en algo que se repite a diario, dos
 * de tres es un día bueno. Tratarlo de otra forma enseña a abandonar en cuanto
 * se rompe la racha.
 */
export function textoDiario(p: ProgresoDiario): string {
  if (p.total === 0) return '';
  if (p.completa) return 'Hecha. Mañana otra vez.';
  // El singular importa: "1 cosas cortas" delata que nadie ha leído la
  // pantalla, y quien lo lee piensa lo mismo del resto de la app.
  if (p.hechos === 0) {
    return p.total === 1
      ? 'Una cosa corta, cuando puedas.'
      : frase`${p.total} cosas cortas, cuando puedas.`;
  }
  return frase`${p.hechos} de ${p.total}. Lo que caiga suma.`;
}
