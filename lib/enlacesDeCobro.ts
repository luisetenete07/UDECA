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
 * Payment Links de Stripe, los CINCO de producción. COBRAN DE VERDAD.
 *
 *   - Alta de entrenador:          1 € (pago único)
 *   - Alta de atleta:              1 € (pago único)
 *   - Suscripción de entrenador: 180 €/año
 *   - Suscripción de atleta:      10 €/mes
 *   - Atleta, pagando el año:     96 €/año  (ver ATHLETE_ANNUAL_EUR)
 *
 * Están creados en el perfil de UDECA, y las claves de Vercel
 * (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) son de ESE MISMO perfil. Tienen
 * que ir juntos: con las claves de otra cuenta, el pago entra y la cuenta no se
 * activa nunca, sin dar ningún error. Ver PAGOS_ACTIVOS en lib/planBase.ts.
 *
 * La app les añade `?client_reference_id=<uid>` para que el webhook active la
 * cuenta correcta sola, y `prefilled_email` para no hacer escribir el correo.
 *
 * NUNCA los de prueba (`buy.stripe.com/test_…`): abren la pasarela, aceptan la
 * tarjeta, dan las gracias y no cobran nada, así que quien pulsara se quedaría
 * convencido de haber pagado. Se distinguen por cinco letras y ya estuvieron
 * publicados una vez, de ahí el guardián en scripts/check-pago-ios.mjs.
 *
 * Los dos del alta son los MISMOS que van en `web/config.js`: la web los usa
 * para quien llega de fuera y la app para quien se registró sin pasar por ella.
 * Si cambias uno, cambia el otro — check-stripe.mjs se queja si se separan.
 */
export const COACH_PAYMENT_LINK: string =
  'https://buy.stripe.com/eVqcN4cuP9qH70IgPW3sI02';
export const ATHLETE_PAYMENT_LINK: string =
  'https://buy.stripe.com/5kQ3cudyT8mDetafLS3sI03';
export const COACH_ENTRY_LINK: string =
  'https://buy.stripe.com/5kQeVc8ezdGX84MbvC3sI00';
export const ATHLETE_ENTRY_LINK: string =
  'https://buy.stripe.com/4gMdR8gL50UbbgY9nu3sI01';
/** El quinto: el atleta que paga el año (ver ATHLETE_ANNUAL_EUR). */
export const ATHLETE_ANNUAL_LINK: string =
  'https://buy.stripe.com/3cIdR866rcCT98Q9nu3sI05';

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
 * Cómo quiere pagar el atleta. El entrenador solo tiene anual, así que no elige.
 */
export type PlanElegido = 'monthly' | 'annual';

/**
 * URL de suscripción para este usuario, con su uid para la activación auto.
 *
 * El `plan` solo lo mira el atleta, que es quien tiene dos formas de pagar. Por
 * defecto la mensual: si algún día se llama sin decir cuál, que sea la barata
 * de entrada y no la de 96 €.
 */
export function subscriptionCheckoutUrl(
  profile: UserProfile | null,
  plan: PlanElegido = 'monthly'
): string | null {
  if (!profile) return null;
  const base =
    profile.role === 'athlete'
      ? plan === 'annual'
        ? ATHLETE_ANNUAL_LINK
        : ATHLETE_PAYMENT_LINK
      : COACH_PAYMENT_LINK;
  if (!base) return null;
  return conQuienPaga(base, profile);
}
