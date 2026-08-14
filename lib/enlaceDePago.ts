import type { UserProfile } from './types';
import { frase } from './idioma';

/**
 * El enlace de cobro, uno por alumno.
 *
 * Antes era del ENTRENADOR: un solo enlace para todo el grupo. Eso solo
 * funciona si todo el mundo paga lo mismo, y no es así casi nunca: hay quien
 * entra con la tarifa de lanzamiento, quien tiene plan trimestral, quien vino
 * de una promoción y quien pactó un precio a mano. Con un enlace único, o el
 * botón de pagar cobraba de más a unos y de menos a otros, o directamente no
 * se podía usar y todo el mundo pagaba por fuera.
 *
 * Ahora el enlace vive en la FICHA DE CADA ALUMNO, junto a su cuota. Cada uno
 * paga lo suyo de un toque, y el entrenador puede tener tantos planes como
 * quiera sin pelearse con la app.
 *
 * Se fue con ello el alta de Stripe Connect ("conectar mis cobros"): era la
 * otra forma de cobrar, obligaba a montar una cuenta conectada y también
 * cobraba lo mismo a todos, calculado desde la cuota. Un enlace pegado hace lo
 * mismo, sirve igual para Stripe que para Bizum, PayPal o Revolut, y no obliga
 * a nadie a darse de alta en nada.
 */

/** Un enlace de cobro solo vale si es una dirección de verdad. */
export function enlaceValido(link: string | undefined | null): boolean {
  const t = (link ?? '').trim();
  if (!t) return false;
  try {
    const u = new URL(t);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * El enlace con el que este alumno paga, si tiene uno.
 *
 * Sale de SU ficha y de ningún otro sitio. No hay respaldo al enlace del
 * entrenador a propósito: si lo hubiera, quien tenga tarifa distinta pagaría
 * la del grupo sin enterarse, que es justo el problema que esto viene a
 * arreglar. Vale más un botón que no aparece que un botón que cobra de menos.
 */
export function enlaceDePagoDe(cliente: Pick<UserProfile, 'paymentLink'> | null | undefined): string | null {
  const t = (cliente?.paymentLink ?? '').trim();
  return enlaceValido(t) ? t : null;
}

/**
 * El enlace listo para abrir.
 *
 * Si es de Stripe se le engancha el `client_reference_id` con el uid del
 * alumno: es lo que permite al webhook saber QUIÉN ha pagado y marcar el cobro
 * solo, sin que el entrenador tenga que confirmarlo a mano. Los demás
 * (Bizum, PayPal, Revolut) se abren tal cual, que no entienden ese parámetro.
 */
export function urlDePago(link: string, clientId: string): string {
  if (!clientId || !/stripe\.com/i.test(link)) return link;
  // Si ya lo lleva puesto (el entrenador copió el enlace con parámetro), no se
  // duplica: dos client_reference_id en la misma dirección es un pago perdido.
  try {
    const u = new URL(link);
    if (u.searchParams.has('client_reference_id')) return link;
  } catch {
    return link;
  }
  const sep = link.includes('?') ? '&' : '?';
  return `${link}${sep}client_reference_id=${encodeURIComponent(clientId)}`;
}

/**
 * Lo que se le dice al entrenador sobre el enlace de un alumno.
 *
 * Sin enlace no se avisa de un fallo: no lo es. Hay entrenadores que cobran en
 * mano o por transferencia y no quieren botón ninguno; a esos no hay que
 * ponerles una alerta roja cada vez que abren una ficha.
 */
export function pistaDelEnlace(link: string | undefined, cuota?: number): string {
  const t = (link ?? '').trim();
  if (!t) {
    return cuota
      ? frase`Sin enlace, ${cuota} € se cobran por fuera y se confirman a mano. Con enlace, tu alumno paga de un toque.`
      : 'Pega aquí el enlace con el que paga ESTE alumno. Cada uno puede tener el suyo, con su precio.';
  }
  if (!enlaceValido(t)) return 'Eso no parece una dirección. Tiene que empezar por https://';
  return /stripe\.com/i.test(t)
    ? 'Enlace de Stripe: al pagar, el cobro se confirma solo.'
    : 'Enlace guardado. Al pagar por fuera de Stripe, tendrás que confirmar el cobro a mano.';
}
