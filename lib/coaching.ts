/**
 * EL PERIODO DE COACHING DE UN ALUMNO: hasta cuándo entrena con su entrenador.
 *
 * Es lo único que la app lleva de la relación entre los dos. El dinero —cuánto
 * cobra, por dónde y si ya ha pagado— es cosa suya, fuera de UDECA: llevarlo
 * aquí convertía la ficha del alumno en una hoja de cobros, y lo que el
 * entrenador necesita saber de un vistazo es otra cosa: si ese alumno está
 * dentro, cuánto le queda y cuándo hay que renovar.
 *
 * La fecha vive en `nextPaymentDate`, el campo de siempre: así los periodos que
 * ya estaban puestos siguen valiendo sin migrar nada. Solo cambia lo que se
 * enseña.
 *
 * Si la fecha se pasa más de `DIAS_DE_MARGEN`, al alumno se le pausa la app
 * hasta que su entrenador la renueve (ver `clientIsLocked` en planBase.ts).
 *
 * Sin imports a propósito: así el guardián (scripts/check-coaching.mjs) lo
 * ejecuta de verdad en Node.
 */

const DIA = 24 * 60 * 60 * 1000;

/**
 * Días desde que se acaba el periodo hasta que se pausa la app. Cinco: un
 * despiste o un fin de semana no deja fuera a nadie, y el entrenador tiene
 * tiempo de renovarlo antes de que el alumno lo note.
 */
export const DIAS_DE_MARGEN = 5;

/** Cuándo se avisa de que se acaba: la última semana. */
export const DIAS_DE_AVISO = 7;

/** Lo que se ofrece con un toque para alargarlo. */
export const ALARGAR_MESES = [1, 3, 6] as const;

export type EstadoDelCoaching =
  /** Sin fecha: entra siempre. */
  | 'sin-fecha'
  /** Dentro y con margen de sobra. */
  | 'activo'
  /** Dentro, pero se acaba esta semana. */
  | 'acaba'
  /** Se ha acabado: está en los días de margen, todavía entra. */
  | 'terminado'
  /** Pasado el margen: la app está en pausa. */
  | 'pausado';

export interface Coaching {
  estado: EstadoDelCoaching;
  /** Fin del periodo, o null si no tiene. */
  hasta: number | null;
  /** Días que quedan (0 = hoy). Negativo si ya pasó. null sin fecha. */
  dias: number | null;
  /** Días que le quedan antes de que se pause la app, si ya se acabó. */
  diasParaPausa: number | null;
}

function inicioDelDia(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** El estado del periodo, tal y como se enseña en la ficha y en el panel. */
export function coachingDe(
  perfil: { nextPaymentDate?: number | null } | null | undefined,
  ahora: number = Date.now()
): Coaching {
  const hasta = perfil?.nextPaymentDate ?? null;
  if (!hasta) return { estado: 'sin-fecha', hasta: null, dias: null, diasParaPausa: null };
  // Por días de calendario, no por horas: "acaba hoy" tiene que salir todo el
  // día, no solo hasta la hora en que se puso la fecha.
  const dias = Math.round((inicioDelDia(hasta) - inicioDelDia(ahora)) / DIA);
  if (dias >= 0) {
    return { estado: dias <= DIAS_DE_AVISO ? 'acaba' : 'activo', hasta, dias, diasParaPausa: null };
  }
  // Entra los DIAS_DE_MARGEN días siguientes al final; al otro, pausa.
  const diasParaPausa = DIAS_DE_MARGEN + 1 + dias;
  if (diasParaPausa > 0) return { estado: 'terminado', hasta, dias, diasParaPausa };
  return { estado: 'pausado', hasta, dias, diasParaPausa: 0 };
}

/**
 * Suma meses conservando el día del mes; el 31 de enero + 1 mes es el 28 de
 * febrero, no el 3 de marzo.
 */
export function sumarMeses(ts: number, meses: number): number {
  const d = new Date(ts);
  const dia = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + meses);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimo));
  return d.getTime();
}

/**
 * La nueva fecha al alargar el periodo.
 *
 * Desde el FINAL del periodo si aún no ha llegado —renovar antes de tiempo no
 * le quita días a nadie— y desde HOY si ya pasó: el mes que se renueva es el
 * que va a entrenar, no el que ya se fue.
 */
export function alargar(hasta: number | null | undefined, meses: number, ahora: number = Date.now()): number {
  const base = hasta && hasta > ahora ? hasta : ahora;
  return sumarMeses(base, meses);
}

/**
 * Una fecha escrita a mano: "13/02/2027", "13-2-27" o "2027-02-13". Devuelve
 * el final de ese día, o null si no es una fecha.
 */
export function fechaEscrita(texto: string): number | null {
  const t = texto.trim();
  let d: number, m: number, a: number;
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const es = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (iso) [a, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (es) [d, m, a] = [Number(es[1]), Number(es[2]), Number(es[3])];
  else return null;
  if (a < 100) a += 2000;
  const f = new Date(a, m - 1, d, 23, 59, 0, 0);
  // new Date desborda en silencio (31/02 → 3 de marzo): eso no es una fecha.
  if (f.getFullYear() !== a || f.getMonth() !== m - 1 || f.getDate() !== d) return null;
  return f.getTime();
}
