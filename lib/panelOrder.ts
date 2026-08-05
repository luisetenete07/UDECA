/**
 * El orden de los bloques de un panel: la parte que se puede razonar sola.
 *
 * Vive separada del hook (`lib/usePanelOrder.ts`) a propósito. Aquí no se
 * importa React ni el almacén, así que esta regla —la que decide qué se ve y
 * en qué orden— se puede comprobar con `node` sin levantar la app, que es lo
 * que hace `scripts/check-panel-order.mjs`. El repo ya separa así lo que de
 * verdad importa (weekPlan, blockView, cyclePlan).
 */

/** La clave con la que se guarda el orden de un panel en el dispositivo. */
export const clavePanel = (panel: string) => `panel-orden-${panel}`;

/**
 * Cruza el orden guardado con los bloques que existen HOY.
 *
 * LO GUARDADO NO MANDA SOBRE LO QUE EXISTE: los identificadores que ya no
 * existen se caen y los que la app ha añadido después entran al final. Sin ese
 * cruce, un panel ordenado hace seis meses se quedaría sin las secciones
 * añadidas más tarde —invisibles para siempre y sin que nadie entienda por
 * qué—, que es la manera clásica de que una preferencia guardada se convierta
 * en un fallo.
 */
export function mezclarOrden(guardado: string[], actuales: string[]): string[] {
  const existe = new Set(actuales);
  const vistos = new Set<string>();
  const conocidos: string[] = [];
  for (const id of guardado) {
    if (existe.has(id) && !vistos.has(id)) {
      vistos.add(id);
      conocidos.push(id);
    }
  }
  const nuevos = actuales.filter((id) => !vistos.has(id));
  return [...conocidos, ...nuevos];
}
