/*
 * A quién le toca qué número de fundador.
 *
 * Vive aparte del alta a propósito: aquí no se importa `firebase-admin` ni nada
 * que necesite credenciales, así que la regla se puede comprobar con `node` sin
 * levantar Firestore (`scripts/check-founder-numbers.mjs`).
 *
 * Y merece esa comprobación más que casi nada del repositorio: un número
 * repartido no se puede quitar. Si esto falla, dos personas se quedan con el
 * mismo "entrenador nº 1" para siempre y no hay despliegue que lo arregle.
 */

/**
 * Una serie por oficio: el campo del contador de cada rol.
 *
 * Entrenador y atleta llevan numeraciones INDEPENDIENTES. Antes salían del
 * mismo bote, así que el entrenador nº 3 y el atleta nº 4 eran correlativos
 * entre sí sin que eso significara nada: son dos comunidades distintas, cada
 * una con su primero. Solo hay dos porque `aplicarAlta` solo corre para esos
 * dos roles — el alumno entra invitado por su entrenador, no paga alta.
 */
const CAMPO_CONTADOR = { trainer: 'siguienteEntrenador', athlete: 'siguienteAtleta' };

/**
 * Qué número toca, mirando el documento del contador. Sin efectos: la
 * transacción de abajo la usa, y `scripts/check-founder-numbers.mjs` la
 * comprueba sin necesidad de Firestore.
 *
 * NUNCA SE REUTILIZA UN NÚMERO, y de ahí sale la única parte rara de esta
 * función. Si la campaña ya repartió números con el contador ÚNICO de antes,
 * empezar ahora las dos series en 1 volvería a dar números que ya tienen dueño:
 * habría dos "entrenador nº 3". Así que una serie que todavía no existe arranca
 * donde se quedó el contador viejo. Si no se repartió nada —la campaña arranca
 * cerrada— ese valor es 1 y las dos series empiezan por el principio, que es lo
 * normal.
 */
export function siguienteNumeroDeFundador(datos, rol) {
  if (!datos || datos.abierta !== true) return null;
  const campo = CAMPO_CONTADOR[rol];
  if (!campo) return null;

  const heredado = typeof datos.siguiente === 'number' ? datos.siguiente : 1;
  const numero = typeof datos[campo] === 'number' ? datos[campo] : heredado;
  if (typeof datos.limite === 'number' && numero > datos.limite) return null;
  return { numero, campo };
}
