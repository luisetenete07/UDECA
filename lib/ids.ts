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

/**
 * Id de un ejercicio escrito a mano, deducido de su nombre.
 *
 * El atleta se autoentrena y escribe los nombres él: "Dominadas" no viene de
 * ninguna biblioteca y no tiene id de Firestore. Que el id salga del NOMBRE, y
 * siempre igual, es lo que hace que las dominadas que puso en su plan, las que
 * añadió a mitad de sesión y las de hace tres meses sean el mismo ejercicio: si
 * no, cada una iría por su lado y no habría ni récords ni "la última vez".
 *
 * Va con prefijo para no confundirse nunca con un id de la biblioteca de un
 * entrenador, y sin tildes ni mayúsculas para que "Dominadas" y "dominadas"
 * sean lo mismo, que es lo que espera quien las escribe.
 */
export function idDeEjercicioPropio(nombre: string): string {
  return (
    'self-' +
    (nombre || 'ej')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  );
}
