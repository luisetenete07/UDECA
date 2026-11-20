import type { DatoTarjeta } from '../components/ProgressCard';
import { frase, t } from './idioma';
import { localeActual, mayusculaInicial, mesLargo } from './fechas';

/**
 * Qué cifras salen en la tarjeta, y en qué orden.
 *
 * La regla es una sola: **solo entra lo que es verdad y significa algo**. Una
 * tarjeta con "0 entrenos" no motiva a nadie, avergüenza; y un puesto en la
 * clasificación cuando sois dos no es un puesto, es una obviedad. Cada cifra
 * tiene que superar su listón o no aparece, aunque eso deje la tarjeta con un
 * solo dato el primer día. Un solo dato verdadero vale más que cuatro
 * rellenos.
 */

const MES_MS = 30.4 * 24 * 60 * 60 * 1000;

/**
 * "mayo de 2026", en minúscula: va dentro de una frase ("entrenando desde
 * mayo de 2026"), así que no lleva la mayúscula de `mesLargo`.
 */
export function desdeCuando(ts?: number): string | undefined {
  if (!ts) return undefined;
  return mesLargo(ts).toLowerCase();
}

export interface DatosEntrenador {
  createdAt?: number;
  /** Alumnos en el grupo ahora mismo. */
  alumnos: number;
  /** Sesiones registradas por todo su grupo, desde siempre. */
  entrenosDirigidos: number;
}

export function tarjetaDeEntrenador(d: DatosEntrenador): DatoTarjeta[] {
  const out: DatoTarjeta[] = [];
  if (d.alumnos > 0) {
    out.push({
      etiqueta: t(d.alumnos === 1 ? 'Alumno a tu cargo' : 'Alumnos a tu cargo'),
      valor: String(d.alumnos),
    });
  }
  // Por debajo de diez sesiones dirigidas la cifra no dice nada de nadie: es
  // la primera semana de cualquiera.
  if (d.entrenosDirigidos >= 10) {
    out.push({
      etiqueta: t('Entrenos dirigidos'),
      valor: d.entrenosDirigidos.toLocaleString(localeActual()),
    });
  }
  return out.length > 0 ? out : [{ etiqueta: t('Entrenador'), valor: 'MASTERY' }];
}

export interface DatosAtleta {
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

export function tarjetaDeAtleta(d: DatosAtleta, ahora = Date.now()): DatoTarjeta[] {
  const out: DatoTarjeta[] = [];
  if (d.entrenos > 0) {
    out.push({
      etiqueta: t(d.entrenos === 1 ? 'Entrenamiento' : 'Entrenamientos'),
      valor: d.entrenos.toLocaleString(localeActual()),
    });
  }
  // Un día de racha no es una racha. A partir de tres ya es una decisión.
  if (d.racha >= 3) {
    out.push({ etiqueta: t('Días seguidos'), valor: String(d.racha) });
  }
  // El puesto solo cuenta si hay contra quién: en un grupo de dos, ser
  // segundo es ser el último y enseñarlo no le hace ilusión a nadie.
  if (d.puesto && d.deCuantos && d.deCuantos >= 3) {
    out.push({ etiqueta: frase`De ${d.deCuantos} en tu grupo`, valor: `Nº ${d.puesto}` });
  }
  const meses = mesesDesde(d.createdAt, ahora);
  if (meses >= 1) {
    out.push({ etiqueta: t('Con Luis Tena'), valor: `${meses} ${t(meses === 1 ? 'mes' : 'meses')}` });
  }
  return out.length > 0 ? out : [{ etiqueta: t('Empieza hoy'), valor: t('Tu primer entreno') }];
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
