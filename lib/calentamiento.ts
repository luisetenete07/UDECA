import { frase, t } from './idioma';
import type { CalentamientoDelDia, ModoDeCalentamiento, RoutineDay } from './types';

/**
 * EL CALENTAMIENTO DE CADA DÍA, COMO LO QUIERA EL ENTRENADOR.
 *
 * Hasta ahora era el mismo para todos: cardio suave, movilidad y unas
 * aproximaciones (lo único que el entrenador podía escribir). Ahora, en cada
 * día de la rutina, elige:
 *
 *  - Un vídeo general y ya ('video'): el alumno le da al play y lo sigue.
 *  - Un vídeo por ejercicio ('videos'): una lista, cada uno con el suyo.
 *  - Solo ejercicios ('ejercicios'): la lista, sin vídeos.
 *
 * Sin elegir nada, el de siempre. Las aproximaciones (las series progresivas
 * hacia el peso de trabajo) siguen yendo al final si las ha escrito.
 */

export const MODOS_DE_CALENTAMIENTO: { valor: ModoDeCalentamiento | 'defecto'; texto: string }[] = [
  { valor: 'defecto', texto: 'El de siempre' },
  { valor: 'video', texto: 'Un vídeo' },
  { valor: 'videos', texto: 'Vídeo por ejercicio' },
  { valor: 'ejercicios', texto: 'Solo ejercicios' },
];

/** Los pasos del de siempre. */
export const CALENTAMIENTO_POR_DEFECTO = ['Cardio suave · 5 min', 'Movilidad con gomas y activación'];

export interface PasoDeCalentamiento {
  texto: string;
  cuanto?: string;
  video?: string;
}

export interface CalentamientoParaVer {
  /** Un vídeo para todo (modo 'video'). */
  video?: string;
  nota?: string;
  pasos: PasoDeCalentamiento[];
  /** Puesto por el entrenador (y no el de siempre). */
  propio: boolean;
}

/** Lo que ve el alumno antes de empezar. */
export function calentamientoParaVer(
  day: Pick<RoutineDay, 'calentamiento' | 'approachesNote'>
): CalentamientoParaVer {
  const c = calentamientoParaGuardar(day.calentamiento);
  const aproximaciones = day.approachesNote?.trim();
  if (!c) {
    return {
      propio: false,
      pasos: [
        ...CALENTAMIENTO_POR_DEFECTO.map((texto) => ({ texto })),
        { texto: aproximaciones ? frase`Aproximaciones · ${aproximaciones}` : t('Aproximaciones (series progresivas hacia tu peso de trabajo)') },
      ],
    };
  }
  const pasos: PasoDeCalentamiento[] = (c.ejercicios ?? []).map((e) => ({
    texto: e.nombre,
    cuanto: e.cuanto,
    video: c.modo === 'videos' ? e.video : undefined,
  }));
  if (aproximaciones) pasos.push({ texto: frase`Aproximaciones · ${aproximaciones}` });
  return { propio: true, video: c.modo === 'video' ? c.video : undefined, nota: c.nota, pasos };
}

/**
 * El calentamiento tal y como se guarda: sin huecos, y sin lo que no es de su
 * modo (un vídeo general en "solo ejercicios", vídeos sueltos en "un vídeo").
 * Si no queda nada que hacer, nada: vuelve el de siempre.
 */
export function calentamientoParaGuardar(c: CalentamientoDelDia | undefined): CalentamientoDelDia | undefined {
  if (!c) return undefined;
  const nota = c.nota?.trim() || undefined;
  if (c.modo === 'video') {
    const video = c.video?.trim();
    return video ? { modo: 'video', video, ...(nota ? { nota } : {}) } : undefined;
  }
  const ejercicios = (c.ejercicios ?? [])
    .map((e) => ({
      id: e.id,
      nombre: e.nombre.trim(),
      ...(e.cuanto?.trim() ? { cuanto: e.cuanto.trim() } : {}),
      ...(c.modo === 'videos' && e.video?.trim() ? { video: e.video.trim() } : {}),
    }))
    .filter((e) => e.nombre);
  return ejercicios.length > 0 ? { modo: c.modo, ejercicios, ...(nota ? { nota } : {}) } : undefined;
}

/** "Un vídeo", "4 ejercicios", "El de siempre": lo que hay puesto, en una línea. */
export function resumenDelCalentamiento(c: CalentamientoDelDia | undefined): string {
  const g = calentamientoParaGuardar(c);
  if (!g) return t('El de siempre');
  if (g.modo === 'video') return t('Un vídeo');
  const n = g.ejercicios?.length ?? 0;
  const conVideo = (g.ejercicios ?? []).filter((e) => e.video).length;
  const ejercicios = n === 1 ? t('1 ejercicio') : frase`${n} ejercicios`;
  return g.modo === 'videos' ? frase`${ejercicios} · ${conVideo} con vídeo` : ejercicios;
}
