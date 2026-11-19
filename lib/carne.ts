import { desdeCuando } from './cardStats';
import { frase } from './idioma';
import type { UserProfile } from './types';

/**
 * El carné de miembro que se enseña fuera de la app.
 *
 * Dentro ya hay uno (components/ProgressCard): el que se mira. Este es el que
 * se comparte —una imagen de 1080×1350 que acaba en un estado de WhatsApp o en
 * una historia—, y por eso lleva otra cosa dentro. El de dentro enseña cifras
 * que cambian: entrenos, racha, puesto. Este enseña QUIÉN ERES, que es lo
 * único que sigue significando algo cuando lo ve alguien que no usa la app.
 *
 * Va por tipo de cuenta porque las cuatro formas de estar aquí no son la misma
 * cosa y enseñarlas iguales las iguala: un entrenador con veinte alumnos y
 * alguien que acaba de comprar una formación no comparten carné en ningún
 * sitio del mundo real, y aquí tampoco.
 */

export type TipoDeCarne = 'coach' | 'alumno' | 'formacion';

export interface Carne {
  tipo: TipoDeCarne;
  /** "ENTRENADOR", "ALUMNO"... Va grande, debajo del nombre. */
  titulo: string;
  /** Una línea de qué significa ese tipo. Corta: se lee de lejos. */
  lema: string;
  /** Las dos letras del sello. Un monograma, no un icono. */
  monograma: string;
  /** Color del sello y de la línea. Todos salen del oro de la marca. */
  acento: string;
  nombre: string;
  /** "Miembro desde mayo de 2026". */
  desde?: string;
}

/**
 * Cada tipo con su color, su monograma y su frase.
 *
 * Los tres colores salen del mismo oro: son el mismo color a distinta
 * luz, no tres colores de marcas distintas. Una tarjeta verde y otra
 * naranja se verían de dos empresas.
 */
const TIPOS: Record<TipoDeCarne, Omit<Carne, 'nombre' | 'desde' | 'tipo'>> = {
  coach: {
    titulo: 'ENTRENADOR',
    lema: 'Dirige Maestría en Calistenia',
    monograma: 'EN',
    acento: '#C9BDB0',
  },
  alumno: {
    titulo: 'ALUMNO',
    lema: 'Entrena con Luis Tena',
    monograma: 'AL',
    acento: '#8A7E73',
  },
  formacion: {
    titulo: 'FORMACIÓN',
    lema: 'Se forma con los cursos de Maestría en Calistenia',
    monograma: 'FO',
    acento: '#B9A98F',
  },
};

/**
 * Qué tipo de carné le toca.
 *
 * El rol decide casi todo. La única distinción que el rol no sabe hacer es la
 * de FORMACIÓN: una cuenta que está aquí por los cursos y no por entrenar. Se
 * reconoce por lo que hace, no por una casilla —está apuntada a alguna
 * formación y no tiene plan de entrenamiento—, porque una casilla habría que
 * mantenerla al día a mano y quedaría mal puesta el día que esa persona
 * empiece a entrenar.
 *
 * El entrenador nunca es FORMACIÓN aunque venda o siga cursos: su carné es el
 * de quien forma a otros, y ese no lo sustituye ninguna otra cosa.
 */
export function tipoDeCarne(
  p: Pick<UserProfile, 'role'> | null | undefined,
  { conCursos = false, conPlan = false }: { conCursos?: boolean; conPlan?: boolean } = {}
): TipoDeCarne {
  if (p?.role === 'trainer') return 'coach';
  if (conCursos && !conPlan) return 'formacion';
  return 'alumno';
}

/** Todo lo que va impreso en el carné, ya resuelto. */
export function datosDelCarne(
  p: UserProfile | null | undefined,
  opciones: { conCursos?: boolean; conPlan?: boolean; ahora?: number } = {}
): Carne | null {
  if (!p) return null;
  const tipo = tipoDeCarne(p, opciones);
  return {
    tipo,
    ...TIPOS[tipo],
    nombre: p.name?.trim() || 'Miembro',
    // Dentro de la app va bajo una placa que ya dice de qué es la fecha. Aquí
    // la tarjeta viaja sola: un "Abril de 2026" suelto no dice desde cuándo
    // qué.
    desde: desdeCuando(p.createdAt) ? frase`Miembro desde ${desdeCuando(p.createdAt)}` : undefined,
  };
}

/**
 * Qué eres, para el rótulo de la marca.
 *
 * Arriba a la izquierda del todo, bajo el nombre de la app, ponía "Entrenador" a todo el
 * mundo: un alumno abría la app y lo primero que leía era que era entrenador.
 * No es un detalle de estilo —es la primera frase que dice la app sobre quien
 * la usa, y estaba equivocada para dos de cada tres cuentas.
 *
 * Se apoya en el mismo mapa que el carné para que las dos cosas no se separen
 * nunca: si un día hay un rol más, sale bien en los dos sitios a la vez.
 */
export function rotuloDelRol(p: Pick<UserProfile, 'role'> | null | undefined): string {
  const t = TIPOS[tipoDeCarne(p)].titulo;
  // "ENTRENADOR" a secas grita; aquí va como nombre propio, no como sello.
  return t.charAt(0) + t.slice(1).toLowerCase();
}
