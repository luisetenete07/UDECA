/**
 * Firestore rechaza cualquier escritura que contenga `undefined` (incluso
 * anidado en arrays u objetos). Como los campos opcionales vacíos de los
 * formularios llegan como `undefined`, este helper los elimina en
 * profundidad antes de escribir: guardar sin rellenar lo opcional es lo
 * esperado, no un error.
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      result[k] = stripUndefined(v);
    }
    return result as T;
  }
  return value;
}
