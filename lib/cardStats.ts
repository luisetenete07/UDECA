import type { DatoTarjeta } from '../components/ProgressCard';
import { mayusculaInicial } from './fechas';
import { numeroFundador } from './fundador';

/**
 * Qué cifras salen en la tarjeta, y en qué orden.
 *
 * La regla es una sola: **solo entra lo que es verdad y significa algo**. Una
 * tarjeta con "0 entrenos" no motiva a nadie, avergüenza; y un puesto en la
 * clasificación cuando sois dos no es un puesto, es una obviedad. Cada cifra
 * tiene que superar su listón o no aparece, aunque eso deje la tarjeta con un
 * solo dato el primer día. Un solo dato verdadero vale más que cuatro
 * rellenos.
 *
 * El número de fundador va siempre primero cuando existe: es lo único
 * irrepetible, lo que no se puede volver a conseguir por mucho que se entrene.
 */

const MES_MS = 30.4 * 24 * 60 * 60 * 1000;

// El número escrito vive en lib/fundador.ts, junto a la regla de cuándo se
// enseña. Aquí se reexporta para no tener dos formas de escribir lo mismo.
export { numeroFundador } from './fundador';

/** "mayo de 2026", con la inicial en mayúscula solo si va sola. */
export function desdeCuando(ts?: number): string | undefined {
  if (!ts) return undefined;
  return new Date(ts).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

export interface DatosEntrenador {
  founderNumber?: number;
  createdAt?: number;
  /** Alumnos en el grupo ahora mismo. */
  alumnos: number;
  /** Sesiones registradas por todo su grupo, desde siempre. */
  entrenosDirigidos: number;
}

/**
 * `conFundador: false` deja el número fuera de la rotación.
 *
 * Se usa cuando el número ya está impreso en la tarjeta de forma permanente:
 * ahí no es una cifra más que compite por su turno, es la identidad, y
 * enseñarlo dos veces en la misma tarjeta lo abarata.
 */
export interface OpcionesTarjeta {
  conFundador?: boolean;
}

export function tarjetaDeEntrenador(
  d: DatosEntrenador,
  ahora = Date.now(),
  { conFundador = true }: OpcionesTarjeta = {}
): DatoTarjeta[] {
  const out: DatoTarjeta[] = [];
  if (conFundador && d.founderNumber && d.founderNumber > 0) {
    out.push({ etiqueta: 'Miembro fundador', valor: numeroFundador(d.founderNumber) });
  }
  if (d.alumnos > 0) {
    out.push({
      etiqueta: d.alumnos === 1 ? 'Alumno a tu cargo' : 'Alumnos a tu cargo',
      valor: String(d.alumnos),
    });
  }
  // Por debajo de diez sesiones dirigidas la cifra no dice nada de nadie: es
  // la primera semana de cualquiera.
  if (d.entrenosDirigidos >= 10) {
    out.push({
      etiqueta: 'Entrenos dirigidos',
      valor: d.entrenosDirigidos.toLocaleString('es-ES'),
    });
  }
  const meses = mesesDesde(d.createdAt, ahora);
  if (meses >= 1) {
    out.push({ etiqueta: 'En UDECA', valor: `${meses} ${meses === 1 ? 'mes' : 'meses'}` });
  }
  return out.length > 0 ? out : [{ etiqueta: 'Entrenador', valor: 'UDECA' }];
}

export interface DatosAtleta {
  founderNumber?: number;
  createdAt?: number;
  /** Entrenos registrados desde siempre. */
  entrenos: number;
  /** Racha en curso, en días. */
  racha: number;
  /** Puesto en la clasificación de su grupo (1 = primero). */
  puesto?: number;
  /** Cuántos son en esa clasificación. */
  deCuantos?: number;
}

export function tarjetaDeAtleta(
  d: DatosAtleta,
  ahora = Date.now(),
  { conFundador = true }: OpcionesTarjeta = {}
): DatoTarjeta[] {
  const out: DatoTarjeta[] = [];
  if (conFundador && d.founderNumber && d.founderNumber > 0) {
    out.push({ etiqueta: 'Miembro fundador', valor: numeroFundador(d.founderNumber) });
  }
  if (d.entrenos > 0) {
    out.push({
      etiqueta: d.entrenos === 1 ? 'Entrenamiento' : 'Entrenamientos',
      valor: d.entrenos.toLocaleString('es-ES'),
    });
  }
  // Un día de racha no es una racha. A partir de tres ya es una decisión.
  if (d.racha >= 3) {
    out.push({ etiqueta: 'Días seguidos', valor: String(d.racha) });
  }
  // El puesto solo cuenta si hay contra quién: en un grupo de dos, ser
  // segundo es ser el último y enseñarlo no le hace ilusión a nadie.
  if (d.puesto && d.deCuantos && d.deCuantos >= 3) {
    out.push({ etiqueta: `De ${d.deCuantos} en tu grupo`, valor: `Nº ${d.puesto}` });
  }
  const meses = mesesDesde(d.createdAt, ahora);
  if (meses >= 1) {
    out.push({ etiqueta: 'En UDECA', valor: `${meses} ${meses === 1 ? 'mes' : 'meses'}` });
  }
  return out.length > 0 ? out : [{ etiqueta: 'Empieza hoy', valor: 'Tu primer entreno' }];
}

function mesesDesde(createdAt: number | undefined, ahora: number): number {
  if (!createdAt) return 0;
  return Math.floor((ahora - createdAt) / MES_MS);
}

/** "Desde mayo de 2026" para la placa del nombre. */
export function textoDesde(ts?: number): string | undefined {
  const d = desdeCuando(ts);
  return d ? mayusculaInicial(d) : undefined;
}
