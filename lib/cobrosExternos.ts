import type { Payment, UserProfile } from './types';

/**
 * Cobrar a alguien que todavía no está en la app.
 *
 * EL HUECO QUE ESTO TAPA. Un entrenador no empieza con la app: empieza con
 * gente que ya le paga. Hasta ahora solo se podía registrar un cobro de un
 * alumno con cuenta, así que sus ingresos de verdad —la mitad, o todos el
 * primer mes— no cabían en ningún sitio. Una pantalla de ingresos que no
 * cuadra con lo que hay en el banco no se mira dos veces.
 *
 * CÓMO SE GUARDA, que es lo que decide si esto envejece bien: un pago externo
 * es un pago normal con un `clientId` inventado a partir del nombre y una copia
 * del nombre dentro. Ni colección nueva, ni reglas nuevas, ni una segunda forma
 * de sumar. Los totales, el historial y el borrado siguen siendo los mismos.
 *
 * EL IDENTIFICADOR ES DETERMINISTA a propósito. "Ana Gil" da siempre el mismo,
 * así que sus tres cobros se agrupan solos bajo una sola ficha en el histórico.
 * Con un id al azar por cobro, Ana saldría tres veces en la lista y el histórico
 * dejaría de servir para lo que sirve.
 *
 * Aquí no se importa nada: es texto y agrupación, y así se puede ejecutar desde
 * el guardián.
 */

/**
 * La marca que distingue a un pagador sin cuenta.
 *
 * Con prefijo y no con un campo aparte porque el `clientId` ya viaja por todas
 * partes —el historial, el borrado, el agrupado— y así ninguna de esas piezas
 * tiene que aprender un caso nuevo. Los uid de Firebase nunca llevan dos
 * puntos, así que no hay forma de que choque con uno real.
 */
export const PREFIJO_EXTERNO = 'externo:';

/** Hasta dónde se puede escribir un nombre. Cabe cualquiera de verdad. */
export const LARGO_DEL_NOMBRE = 40;

/** El nombre tal y como se guarda: sin espacios de más y con tope. */
export function limpiarNombreDePagador(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim().slice(0, LARGO_DEL_NOMBRE).trim();
}

/**
 * El identificador de un pagador sin cuenta, sacado de su nombre.
 *
 * Se quitan tildes y todo lo que no sea letra o número, para que "José" y
 * "Jose" sean el mismo y no aparezcan como dos personas en el histórico. Lo
 * que no se hace es intentar adivinar más allá de eso: si el entrenador
 * escribe "Ana" un mes y "Ana Gil" al siguiente, salen dos fichas. Es
 * previsible, se ve al momento en la lista y se arregla escribiéndolo igual —
 * mucho mejor que un emparejado listo que un día junte a dos personas
 * distintas.
 */
export function idDePagadorExterno(nombre: string): string {
  const base = limpiarNombreDePagador(nombre)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${PREFIJO_EXTERNO}${base}`;
}

/** ¿Este cobro es de alguien sin cuenta en la app? */
export function esPagadorExterno(clientId: string | undefined | null): boolean {
  return (clientId ?? '').startsWith(PREFIJO_EXTERNO);
}

/**
 * Cómo se llama quien pagó.
 *
 * Manda el perfil si existe: si esa persona acabó entrando en la app y se
 * cambió el nombre, el histórico debe decir el de ahora y no el que se escribió
 * hace seis meses. El nombre guardado en el pago es el respaldo, y "Cliente" el
 * último recurso para pagos antiguos que no llevaban ninguno.
 */
export function nombreDelPagador(
  pago: Pick<Payment, 'clientId' | 'clientName'>,
  perfil?: Pick<UserProfile, 'name'> | null
): string {
  const delPerfil = (perfil?.name ?? '').trim();
  if (delPerfil) return delPerfil;
  const guardado = limpiarNombreDePagador(pago.clientName ?? '');
  if (guardado) return guardado;
  return 'Cliente';
}

/**
 * ¿Puede registrarse este cobro?
 *
 * Nombre e importe, y el importe por encima de cero: un cobro de 0 € no es un
 * cobro, es una fila que ensucia el histórico y baja la media sin motivo.
 */
export function cobroValido(nombre: string, importe: number): boolean {
  return limpiarNombreDePagador(nombre).length > 0 && Number.isFinite(importe) && importe > 0;
}

/**
 * El importe escrito a mano, como número.
 *
 * Se acepta la coma además del punto: en un teclado español la coma es lo que
 * sale, y rechazar "12,50" por eso sería culpar al usuario del teclado.
 */
export function importeEscrito(texto: string): number {
  const n = Number(texto.replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}
