import type { UserProfile } from './types';

/**
 * Los enlaces de Stripe y las direcciones que se abren para pagar.
 *
 * POR QUÉ ESTÁN AQUÍ Y NO EN lib/subscription.ts
 *
 * Por lo mismo que `planBase.ts`: `subscription.ts` lee `Platform.OS` al
 * cargarse, así que todo lo que lo importe arrastra React Native entera y no se
 * puede ejecutar en Node pelado. Eso dejaba SIN PROBAR justo la parte que
 * decide a qué producto de Stripe se manda a cada persona.
 *
 * Y esa es la parte cara. Un enlace equivocado no da error: la pasarela se
 * abre, la tarjeta pasa y se cobra otra cosa. Un enlace sin `client_reference_id`
 * tampoco: el dinero entra y la cuenta no se activa nunca, sin un solo aviso.
 * Los dos se descubren mirando las cuentas del mes.
 *
 * Aquí no se importa nada de React Native, así que
 * `scripts/check-cadena-cobro.mjs` recorre la cadena entera de verdad, llamando
 * a estas funciones con cada rol y cada plan.
 *
 * Se reexporta todo desde `lib/subscription.ts` para no tocar ni un import de
 * los que ya había.
 */

/**
 * Payment Links de Stripe. COBRAN DE VERDAD.
 *
 * DOS, NO CUATRO. Y eso es lo que arregla la mitad de los fallos posibles.
 *
 * Había un enlace para el alta y otro para la cuota, por rol. Pero el alta y
 * la cuota son EL MISMO producto desde que la entrada es una suscripción anual
 * con la primera factura a mitad de precio: la web y la app mandan al mismo
 * sitio, y ya no existe la posibilidad de que una cobre un importe y la otra
 * otro, que era la avería cara de este fichero.
 *
 *   - Entrenador: 240 €/año, primera factura 120 €
 *   - Atleta:      60 €/año, primera factura  30 €
 *
 * El descuento del primer año NO está aquí: vive en Stripe, como cupón de un
 * solo uso pegado al enlace. Así la app no tiene que saber nada de ofertas, y
 * cambiar la campaña no es desplegar una versión.
 *
 * SON DE PRODUCCIÓN, Y ESO HAY QUE MIRARLO CADA VEZ
 *
 * NUNCA los de prueba (`buy.stripe.com/test_…`): abren la pasarela, aceptan la
 * tarjeta, dan las gracias y no cobran nada, así que quien pulsara se quedaría
 * convencido de haber pagado. Ya estuvieron publicados una vez, de ahí el
 * guardián en scripts/check-pago-ios.mjs.
 *
 * Y TIENEN QUE SER SUSCRIPCIONES, no pagos sueltos. Si alguno fuera un cobro
 * único, la cuenta se activaría igual y no se renovaría jamás; y en el
 * entrenador, además, no se escribiría `subscriptionPlan: 'annual'`, que es lo
 * único que le quita el tope de cinco alumnos (`planIlimitado`). Un entrenador
 * pagando 240 € y sin poder pasar de cinco alumnos.
 *
 * Los dos son los MISMOS que van en `web/config.js`. Si cambias uno, cambia el
 * otro — check-stripe.mjs se queja si se separan.
 *
 * Si alguno hubiera que quitarlo, se deja VACÍO (''), nunca con el de otro
 * importe: vacío se comporta solo —`entryCheckoutUrl` y
 * `subscriptionCheckoutUrl` devuelven null y el botón no se enseña— y nadie
 * puede pagar el importe que no es.
 *
 * La app les añade `?client_reference_id=<uid>` para que el webhook active la
 * cuenta correcta sola, y `prefilled_email` para no hacer escribir el correo.
 */
/**
 * EL `prefilled_promo_code` NO ES UN ADORNO: es el precio de entrada.
 *
 * El descuento del primer año vive en Stripe como cupón, y el panel no deja
 * pegarlo al Payment Link para que se aplique solo. Sin este parámetro, quien
 * llega a la pasarela ve 240 € donde la web le prometía 120 €, y o se va o
 * paga el doble de lo anunciado. Las dos cosas son igual de malas.
 *
 * Va en la dirección y no en un campo que haya que teclear a propósito: un
 * descuento que hay que escribir a mano se lo salta media pasarela.
 *
 * Y HAY UN SEGUNDO MOTIVO, que es el que decide la forma. Los códigos de los
 * creadores (65 %) van por este MISMO parámetro, así que el suyo SUSTITUYE al
 * del primer año en vez de sumarse. Un 50 % y un 65 % encadenados dejarían la
 * suscripción casi regalada, y eso no se evita confiando en cómo se porte
 * Stripe: se evita porque solo hay un hueco donde cabe un descuento.
 *
 * El código tiene que existir en Stripe con ESTE nombre exacto. Si no existe,
 * la pasarela abre igual y cobra el precio entero, sin avisar.
 */
const PRIMER_ANO = '?prefilled_promo_code=PRIMERANO';

export const COACH_LINK: string =
  `https://buy.stripe.com/3cI3cu8ezdGXacUbvC3sI09${PRIMER_ANO}`;
export const ATHLETE_LINK: string =
  `https://buy.stripe.com/7sY14mgL5dGX2KseHO3sI08${PRIMER_ANO}`;

/*
 * Los cuatro nombres de antes, apuntando a los dos de ahora.
 *
 * No es pereza: `COACH_ENTRY_LINK` y `COACH_PAYMENT_LINK` están escritos en
 * media docena de sitios entre pantallas y guardianes, y renombrarlos en el
 * mismo cambio que mueve los precios mezclaría dos cosas que conviene poder
 * revisar por separado. Apuntan al mismo enlace porque AHORA SON EL MISMO
 * producto, que es justo lo que se quería conseguir.
 */
export const COACH_ENTRY_LINK = COACH_LINK;
export const ATHLETE_ENTRY_LINK = ATHLETE_LINK;
export const COACH_PAYMENT_LINK = COACH_LINK;
export const ATHLETE_ANNUAL_LINK = ATHLETE_LINK;

/**
 * Le pega al enlace el uid y el correo.
 *
 * El uid es lo que hace que el webhook sepa a quién activar. Sin él el pago
 * entra igual y la cuenta se queda muerta, así que va aquí, en un solo sitio,
 * y no en cada llamada.
 */
function conQuienPaga(base: string, profile: UserProfile): string {
  const sep = base.includes('?') ? '&' : '?';
  return (
    `${base}${sep}client_reference_id=${encodeURIComponent(profile.uid)}` +
    `&prefilled_email=${encodeURIComponent(profile.email)}`
  );
}

/** Enlace del alta con el uid dentro, para que el webhook sepa a quién activar. */
export function entryCheckoutUrl(profile: UserProfile | null): string | null {
  if (!profile) return null;
  const base = profile.role === 'athlete' ? ATHLETE_ENTRY_LINK : COACH_ENTRY_LINK;
  if (!base) return null;
  return conQuienPaga(base, profile);
}

/**
 * URL de la cuota anual, con su uid para la activación automática.
 *
 * Ya no hay nada que elegir: se paga por años. Antes el atleta tenía mensual o
 * anual y había que decirle a esta función cuál; ahora el atleta renueva a 95 €
 * al año y el entrenador a 180 €, y cada rol tiene un único enlace.
 */
export function subscriptionCheckoutUrl(profile: UserProfile | null): string | null {
  if (!profile) return null;
  const base = profile.role === 'athlete' ? ATHLETE_ANNUAL_LINK : COACH_PAYMENT_LINK;
  if (!base) return null;
  return conQuienPaga(base, profile);
}
