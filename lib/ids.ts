/**
 * Identificadores locales: días de rutina, ejercicios, secciones, lecciones.
 *
 * Son ids de piezas que viven DENTRO de un documento, no documentos de
 * Firestore: solo tienen que ser únicos entre hermanos y estables mientras se
 * edita. Había cuatro generadores repartidos por la app y dos formatos
 * distintos, lo que además hacía imposible mirar un id y saber de dónde salió.
 *
 * Lleva delante el instante en base 36 por dos motivos que se notan al editar:
 * ordena solo por antigüedad, y dos piezas creadas en el mismo bucle (duplicar
 * un día con doce ejercicios) no pueden chocar aunque el azar se repita.
 */
export function nuevoId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
