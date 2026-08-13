import { inicioDelDia } from './fechas';
import type { CoachTask, TrainingCycle, UserProfile } from './types';

/**
 * La agenda del entrenador, en su calendario de siempre.
 *
 * POR QUÉ. Un entrenador no vive en UDECA: vive en el calendario del móvil,
 * donde ya están el dentista, la cena del sábado y las clases presenciales. Si
 * los cobros y los bloques de sus alumnos están en otra app, o los mira dos
 * veces o no los mira. Y el día que se le solapa un cobro con un viaje no se
 * entera hasta que ya ha pasado.
 *
 * QUÉ SE LLEVA AL CALENDARIO. Las tres cosas que tienen fecha y consecuencia:
 *  - Las tareas del día que él mismo se apunta.
 *  - Cuándo le toca cobrar a cada alumno.
 *  - Cuándo empieza y acaba cada bloque de entrenamiento.
 * Los objetivos de negocio y las tareas de semana o mes NO van: no tienen día,
 * y meterlos en un día inventado ensucia el calendario de quien lo abre.
 *
 * CÓMO SE EVITA EL DESASTRE CLÁSICO de estas integraciones: duplicar. Cada
 * evento lleva un identificador estable y propio (`uid`), construido a partir
 * de lo que representa y no de cuándo se exportó. Así, exportar dos veces
 * actualiza los mismos eventos en vez de crear una segunda copia de todo; y
 * eso es exactamente lo que separa "conectar el calendario" de "llenarle el
 * calendario de basura".
 *
 * Todo lo de aquí es texto puro y sin dependencias: lo mismo sirve para
 * escribir en el calendario del móvil (expo-calendar) que para generar el
 * fichero .ics del navegador.
 */

/** Prefijo de todos nuestros identificadores. Sirve para reconocer lo nuestro. */
export const PREFIJO_UID = 'udeca';

/** El dominio que va detrás del uid. No se resuelve; es parte del formato. */
export const DOMINIO = 'udeca.app';

export type TipoDeEvento = 'tarea' | 'cobro' | 'ciclo';

export interface EventoDeAgenda {
  /** Identificador estable. Reexportar actualiza, no duplica. */
  uid: string;
  tipo: TipoDeEvento;
  titulo: string;
  /** Inicio en milisegundos. */
  inicio: number;
  /** Fin en milisegundos. En los de todo el día, el día siguiente a las 00:00. */
  fin: number;
  /** Sin hora: ocupa el día entero en el calendario. */
  todoElDia: boolean;
  notas?: string;
}

const DIA_MS = 24 * 60 * 60 * 1000;

/** Un uid estable y legible: `udeca-cobro-<uid del alumno>-<fecha>@udeca.app`. */
export function uidDeEvento(tipo: TipoDeEvento, id: string, marca?: number): string {
  const limpio = String(id).replace(/[^A-Za-z0-9_-]/g, '') || 'x';
  const cola = marca === undefined ? '' : `-${inicioDelDia(marca)}`;
  return `${PREFIJO_UID}-${tipo}-${limpio}${cola}@${DOMINIO}`;
}

/**
 * Los eventos de la agenda, ya listos para el calendario.
 *
 * Se pide TODO y se filtra aquí, en un solo sitio: si cada pantalla decidiera
 * qué exportar, acabaría exportando cosas distintas según desde dónde se
 * pulse.
 */
export function eventosDeLaAgenda({
  tareas = [],
  alumnos = [],
  ciclos = [],
  desde = Date.now() - 30 * DIA_MS,
  hasta = Date.now() + 365 * DIA_MS,
}: {
  tareas?: CoachTask[];
  alumnos?: UserProfile[];
  ciclos?: TrainingCycle[];
  /** Ventana que se exporta. Fuera de ella no se lleva nada. */
  desde?: number;
  hasta?: number;
}): EventoDeAgenda[] {
  const dentro = (ms: number) => ms >= desde && ms <= hasta;
  const eventos: EventoDeAgenda[] = [];

  for (const t of tareas) {
    // Solo las de día y con fecha: una tarea "de este mes" no tiene día, y
    // ponerla en uno inventado ensucia el calendario de quien lo abre.
    if (t.scope !== 'day' || !t.dueDate || !dentro(t.dueDate)) continue;
    // Las hechas tampoco: el calendario es para lo que queda por hacer.
    if (t.done) continue;
    const dia = inicioDelDia(t.dueDate);
    eventos.push({
      uid: uidDeEvento('tarea', t.id),
      tipo: 'tarea',
      titulo: t.title,
      inicio: dia,
      fin: dia + DIA_MS,
      todoElDia: true,
      notas: t.notes,
    });
  }

  for (const a of alumnos) {
    if (!a.nextPaymentDate || !dentro(a.nextPaymentDate)) continue;
    const dia = inicioDelDia(a.nextPaymentDate);
    eventos.push({
      // Con la fecha dentro del uid: al cobrar y pasar la fecha al mes que
      // viene, es un evento NUEVO y el del mes pasado se queda donde estaba.
      uid: uidDeEvento('cobro', a.uid, dia),
      tipo: 'cobro',
      titulo: `Cobro · ${a.name}`,
      inicio: dia,
      fin: dia + DIA_MS,
      todoElDia: true,
      notas: a.monthlyFeeEur ? `Cuota mensual: ${a.monthlyFeeEur} €` : undefined,
    });
  }

  for (const c of ciclos) {
    // Solo los bloques con principio y fin. Un ciclo abierto no es una cita.
    if (!c.startDate || !c.endDate) continue;
    if (!dentro(c.startDate) && !dentro(c.endDate)) continue;
    eventos.push({
      uid: uidDeEvento('ciclo', c.id),
      tipo: 'ciclo',
      titulo: c.name,
      inicio: inicioDelDia(c.startDate),
      // +1 día: en los calendarios el fin de un evento de día completo es
      // EXCLUSIVO, así que sin esto el último día del bloque no sale.
      fin: inicioDelDia(c.endDate) + DIA_MS,
      todoElDia: true,
      notas: c.goal,
    });
  }

  return eventos.sort((a, b) => a.inicio - b.inicio || a.uid.localeCompare(b.uid));
}

// ---------------------------------------------------------------------------
// iCalendar (RFC 5545)
// ---------------------------------------------------------------------------

/**
 * Escapa un texto para el formato .ics.
 *
 * Las comas y los puntos y coma son separadores de campo: sin escaparlos, un
 * título como "Cobro; Ana, 45 €" parte el evento en tres trozos y el
 * calendario se lo come entero sin decir nada.
 */
export function escapaTexto(texto: string): string {
  return texto
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** `20260813` — la fecha suelta, para los eventos de día completo. */
export function fechaIcs(ms: number): string {
  const d = new Date(ms);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${dos(d.getMonth() + 1)}${dos(d.getDate())}`;
}

/** `20260813T101500Z` — instante en UTC, para la marca de creación. */
export function instanteIcs(ms: number): string {
  return `${new Date(ms).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

/**
 * Parte las líneas a 75 octetos, como manda el formato.
 *
 * No es cosmético: Google Calendar rechaza el fichero entero si una línea se
 * pasa, y el usuario ve "no se pudo importar" sin más explicación.
 */
export function plegaLinea(linea: string): string {
  if (linea.length <= 75) return linea;
  const trozos: string[] = [linea.slice(0, 75)];
  let resto = linea.slice(75);
  while (resto.length > 74) {
    trozos.push(` ${resto.slice(0, 74)}`);
    resto = resto.slice(74);
  }
  if (resto) trozos.push(` ${resto}`);
  return trozos.join('\r\n');
}

/** El fichero .ics entero. Se abre con Google Calendar y con Apple Calendar. */
export function ficheroIcs(eventos: EventoDeAgenda[], ahora = Date.now()): string {
  const lineas: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UDECA//Agenda del entrenador//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:UDECA',
  ];
  for (const e of eventos) {
    lineas.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${instanteIcs(ahora)}`,
      `DTSTART;VALUE=DATE:${fechaIcs(e.inicio)}`,
      `DTEND;VALUE=DATE:${fechaIcs(e.fin)}`,
      `SUMMARY:${escapaTexto(e.titulo)}`,
      ...(e.notas ? [`DESCRIPTION:${escapaTexto(e.notas)}`] : []),
      `CATEGORIES:${e.tipo.toUpperCase()}`,
      'END:VEVENT'
    );
  }
  lineas.push('END:VCALENDAR');
  // CRLF y no \n: hay clientes (Outlook entre ellos) que con \n solo no leen
  // el fichero y no dicen por qué.
  return lineas.map(plegaLinea).join('\r\n') + '\r\n';
}

/** Nombre del fichero que se descarga o se comparte. */
export function nombreDelFichero(nombreDelCoach?: string): string {
  const limpio = (nombreDelCoach ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return limpio ? `agenda-udeca-${limpio}.ics` : 'agenda-udeca.ics';
}

/** Cuántos hay de cada tipo, para poder decirle qué se lleva. */
export function resumenDeEventos(eventos: EventoDeAgenda[]): {
  total: number;
  tareas: number;
  cobros: number;
  ciclos: number;
  texto: string;
} {
  const cuenta = (t: TipoDeEvento) => eventos.filter((e) => e.tipo === t).length;
  const tareas = cuenta('tarea');
  const cobros = cuenta('cobro');
  const ciclos = cuenta('ciclo');
  const partes = [
    tareas > 0 ? `${tareas} ${tareas === 1 ? 'tarea' : 'tareas'}` : '',
    cobros > 0 ? `${cobros} ${cobros === 1 ? 'cobro' : 'cobros'}` : '',
    ciclos > 0 ? `${ciclos} ${ciclos === 1 ? 'bloque' : 'bloques'}` : '',
  ].filter(Boolean);
  return {
    total: eventos.length,
    tareas,
    cobros,
    ciclos,
    texto: partes.length > 0 ? partes.join(' · ') : 'Nada con fecha todavía',
  };
}
