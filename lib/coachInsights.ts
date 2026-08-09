import { inicioDeLaSemana, inicioDelDia } from './fechas';
import type { UserProfile, WorkoutLog } from './types';

/**
 * Quién mejora y quién empeora.
 *
 * Es la pregunta que un entrenador no puede contestar mirando una lista de
 * alumnos, y la que de verdad justifica su trabajo. Hasta ahora había que
 * entrar en cada ficha, mirar la tabla y acordarse de cómo iba el mes pasado:
 * con cinco alumnos son cinco viajes, y con veinte no se hace nunca.
 *
 * Se compara **las dos últimas semanas contra las dos anteriores**, y se cuenta
 * en SERIES, no en kilos: en calistenia casi todo es peso corporal y el volumen
 * en kilos saldría a cero para la mitad de la gente.
 *
 * Dos semanas contra dos, y no una contra una, porque una semana mala la tiene
 * cualquiera —un viaje, un catarro— y avisar de eso es ruido. Lo que importa es
 * la tendencia que aguanta.
 */

const DIA_MS = 24 * 60 * 60 * 1000;
const VENTANA_MS = 14 * DIA_MS;

/** Cambio mínimo para no cantar ruido: por debajo de esto, es "estable". */
const UMBRAL = 0.2;
/** Series mínimas en el periodo anterior para poder comparar con sentido. */
const BASE_MINIMA = 8;

export type Tendencia = 'sube' | 'baja' | 'estable' | 'sin-datos';

export interface AlumnoTendencia {
  uid: string;
  name: string;
  photoURL?: string | null;
  tendencia: Tendencia;
  /** Variación relativa (-1..n). 0,25 = un 25 % más de series. */
  cambio: number;
  seriesAhora: number;
  seriesAntes: number;
  sesionesAhora: number;
  sesionesAntes: number;
}

function seriesYsesiones(logs: WorkoutLog[], desde: number, hasta: number) {
  let series = 0;
  const dias = new Set<number>();
  for (const l of logs) {
    if (l.date < desde || l.date >= hasta) continue;
    let algo = false;
    for (const ex of l.exercises) {
      const hechas = ex.sets.filter((s) => s.completed).length;
      series += hechas;
      if (hechas > 0) algo = true;
    }
    if (algo) {
      dias.add(inicioDelDia(l.date));
    }
  }
  return { series, sesiones: dias.size };
}

export function tendenciaDeAlumnos(
  clients: UserProfile[],
  logs: WorkoutLog[],
  now = Date.now()
): AlumnoTendencia[] {
  // Se corta por semanas naturales: comparar "los últimos 14 días" contra "los
  // 14 anteriores" a media semana mezcla trozos de semana y da saltos raros.
  const finAhora = inicioDeLaSemana(now) + 7 * DIA_MS;
  const iniAhora = finAhora - VENTANA_MS;
  const iniAntes = iniAhora - VENTANA_MS;

  const porAlumno = new Map<string, WorkoutLog[]>();
  for (const l of logs) {
    porAlumno.set(l.clientId, [...(porAlumno.get(l.clientId) ?? []), l]);
  }

  return clients
    .map((c) => {
      const suyos = porAlumno.get(c.uid) ?? [];
      const ahora = seriesYsesiones(suyos, iniAhora, finAhora);
      const antes = seriesYsesiones(suyos, iniAntes, iniAhora);

      let tendencia: Tendencia;
      let cambio = 0;
      if (antes.series < BASE_MINIMA && ahora.series < BASE_MINIMA) {
        // Sin recorrido no se puede hablar de tendencia. Que alguien no entrene
        // ya se dice en otro sitio; aquí decirlo otra vez sería el mismo aviso
        // dos veces.
        tendencia = 'sin-datos';
      } else if (antes.series < BASE_MINIMA) {
        tendencia = 'sube';
        cambio = 1;
      } else {
        cambio = (ahora.series - antes.series) / antes.series;
        tendencia = cambio >= UMBRAL ? 'sube' : cambio <= -UMBRAL ? 'baja' : 'estable';
      }

      return {
        uid: c.uid,
        name: c.name,
        photoURL: c.photoURL,
        tendencia,
        cambio,
        seriesAhora: ahora.series,
        seriesAntes: antes.series,
        sesionesAhora: ahora.sesiones,
        sesionesAntes: antes.sesiones,
      };
    })
    // Lo que necesita acción primero: quien baja más, arriba del todo.
    .sort((a, b) => a.cambio - b.cambio);
}

/** Los que hay que mirar hoy: primero quien baja, luego quien más sube. */
export function destacados(lista: AlumnoTendencia[]): {
  bajan: AlumnoTendencia[];
  suben: AlumnoTendencia[];
} {
  return {
    bajan: lista.filter((a) => a.tendencia === 'baja'),
    // A igualdad de porcentaje manda el volumen: quien empieza de cero también
    // sale como "sube", y sin desempate su puesto dependía del azar.
    suben: lista
      .filter((a) => a.tendencia === 'sube')
      .sort((a, b) => b.cambio - a.cambio || b.seriesAhora - a.seriesAhora),
  };
}
