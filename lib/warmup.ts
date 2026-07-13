/**
 * Calentamiento sugerido según los patrones del día: a partir de los grupos
 * musculares de los ejercicios planificados se propone una entrada en calor
 * específica de calistenia. Determinista y editable en el futuro por coach.
 */

const BY_GROUP: Record<string, string[]> = {
  Empuje: [
    'Rotaciones de hombro con goma × 15',
    'Activación escapular (push-up plus) × 10',
    'Flexiones lentas a medio rango × 8',
  ],
  Tirón: [
    'Colgado activo en barra 2 × 20s',
    'Remo ligero con goma × 15',
    'Retracciones escapulares colgado × 8',
  ],
  'Tren inferior': [
    'Sentadillas sin peso × 15',
    'Movilidad de tobillo y cadera 1 min',
    'Zancadas dinámicas × 10',
  ],
  Core: ['Cat-camel × 10', 'Hollow body suave 2 × 15s'],
  'Tren superior': ['Círculos de brazos × 20', 'Rotaciones de muñeca 30s'],
  'Full body': ['Jumping jacks × 30', 'Movilidad general 2 min'],
  Movilidad: ['Respiración + movilidad articular 2 min'],
};

/** Sugerencia de calentamiento (máx. 5 pasos) para los grupos del día. */
export function suggestWarmup(groups: Iterable<string>): string[] {
  const items: string[] = ['Cardio suave 2-3 min (comba, trote, remo)'];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const item of BY_GROUP[group] ?? []) {
      if (!seen.has(item)) {
        seen.add(item);
        items.push(item);
      }
      if (items.length >= 5) return items;
    }
  }
  // Día sin grupos reconocibles: movilidad general.
  if (items.length === 1) items.push('Movilidad articular general 3 min');
  return items;
}
