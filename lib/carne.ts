import { desdeCuando } from './cardStats';
import { estadoInsignia, numeroFundador } from './fundador';
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
 *
 * El número de fundador, cuando está encendido, manda sobre todo lo demás. Es
 * el único dato de esta tarjeta que no se puede conseguir más tarde.
 */

export type TipoDeCarne = 'coach' | 'atleta' | 'alumno' | 'formacion';

export interface Carne {
  tipo: TipoDeCarne;
  /** "ENTRENADOR", "ATLETA"... Va grande, debajo del nombre. */
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
  /** "#0028", ya escrito, y SOLO si la insignia está encendida. */
  fundador?: string;
}

/**
 * Cada tipo con su color, su monograma y su frase.
 *
 * Los cuatro colores salen del mismo oro: son el mismo material a distinta
 * temperatura, no cuatro colores de marcas distintas. Una tarjeta verde y otra
 * azul se verían de dos empresas.
 */
const TIPOS: Record<TipoDeCarne, Omit<Carne, 'nombre' | 'desde' | 'fundador' | 'tipo'>> = {
  coach: {
    titulo: 'ENTRENADOR',
    lema: 'Forma a otros dentro de UDECA',
    monograma: 'EN',
    acento: '#C9BDB0',
  },
  atleta: {
    titulo: 'ATLETA',
    lema: 'Se entrena a sí mismo',
    monograma: 'AT',
    acento: '#A2968B',
  },
  alumno: {
    titulo: 'ALUMNO',
    lema: 'Entrena con su entrenador',
    monograma: 'AL',
    acento: '#8A7E73',
  },
  formacion: {
    titulo: 'FORMACIÓN',
    lema: 'Estudia en la Universidad de Calistenia',
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
  return p?.role === 'athlete' ? 'atleta' : 'alumno';
}

/** Todo lo que va impreso en el carné, ya resuelto. */
export function datosDelCarne(
  p: UserProfile | null | undefined,
  opciones: { conCursos?: boolean; conPlan?: boolean; ahora?: number } = {}
): Carne | null {
  if (!p) return null;
  const tipo = tipoDeCarne(p, opciones);
  // El número solo se imprime si la insignia está encendida: una tarjeta que
  // se comparte no puede decir "fundador" de quien ahora mismo no está dentro.
  // El número no se pierde —vuelve solo al volver—, pero mientras tanto no se
  // enseña.
  const insignia = estadoInsignia(p, opciones.ahora ?? Date.now());
  return {
    tipo,
    ...TIPOS[tipo],
    nombre: p.name?.trim() || 'Miembro',
    // Dentro de la app va bajo una placa que ya dice de qué es la fecha. Aquí
    // la tarjeta viaja sola: un "Abril de 2026" suelto no dice desde cuándo
    // qué.
    desde: desdeCuando(p.createdAt) ? `Miembro desde ${desdeCuando(p.createdAt)}` : undefined,
    fundador: insignia.activa && insignia.numero ? numeroFundador(insignia.numero) : undefined,
  };
}
