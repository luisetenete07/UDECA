/*
 * Lo que enseña el widget "Hoy", decidido sin tocar nada del móvil: así se
 * puede probar (scripts/check-widget-hoy.mjs). Guardarlo y repintarlo, en
 * lib/widgetHoy.ts.
 */

export interface DatosDelWidget {
  /** "Empuje", "Descanso"… */
  titulo: string;
  /** "5 ejercicios", "Entreno hecho"… */
  detalle: string;
  hecho: boolean;
  pasos: number | null;
  objetivoPasos: number;
  /** El día al que se refiere (medianoche): pasado ese día, ya no vale. */
  dia: number;
}

/** Lo que dice el widget, a partir de lo que ya sabe el inicio. */
export function datosDelWidget(p: {
  dia: number;
  nombreDelDia?: string | null;
  ejercicios?: number;
  descanso?: boolean;
  enPausa?: boolean;
  hecho?: boolean;
  sinPlan?: boolean;
  pasos?: number | null;
  objetivoPasos: number;
}): DatosDelWidget {
  const base = { dia: p.dia, pasos: p.pasos ?? null, objetivoPasos: p.objetivoPasos };
  if (p.sinPlan) return { ...base, titulo: 'Sin plan todavía', detalle: 'Tu entrenador te lo prepara', hecho: false };
  if (p.enPausa) return { ...base, titulo: 'Plan en pausa', detalle: 'Hoy no toca entrenar', hecho: false };
  if (p.hecho) return { ...base, titulo: p.nombreDelDia || 'Entreno de hoy', detalle: 'Hecho. Buen trabajo', hecho: true };
  if (p.descanso) return { ...base, titulo: 'Descanso', detalle: 'Hoy toca recuperar', hecho: false };
  const n = p.ejercicios ?? 0;
  return {
    ...base,
    titulo: p.nombreDelDia || 'Entreno de hoy',
    detalle: n === 1 ? '1 ejercicio' : `${n} ejercicios`,
    hecho: false,
  };
}
