import { Platform } from 'react-native';
import type { UserProfile } from './types';
import {
  clientSlotsOf,
  DAY_MS,
  FREE_CLIENT_LIMIT,
  isAdmin,
  subscriptionState,
} from './planBase';

/**
 * Modelo SaaS de UDECA: los COACHES pagan la plataforma; sus alumnos entran
 * gratis con el código del coach.
 *
 *  - ALTA: 1 € una sola vez, al registrarse, tanto entrenador como atleta.
 *    No es el precio del producto: es el peaje que filtra al curioso y —lo
 *    importante— deja una TARJETA identificada. Ver `ENTRY_PRICE_EUR`.
 *  - ENTRENADOR: con el alta pagada entran FREE_CLIENT_LIMIT alumnos. Para
 *    pasar de ahí, 180 €/año. Entra y usa la app entera desde el primer día;
 *    el muro solo aparece cuando su grupo crece. Pedirle 180 € antes de haber
 *    visto el producto era el mayor punto de fuga del negocio.
 *  - ATLETA: 14 días desde el alta y después 10 €/mes.
 *  - ALUMNO de un coach: gratis siempre.
 *  - Cuentas sin `subscriptionUntil` = fundadoras (anteriores a la
 *    monetización): acceso completo para no romper nada.
 *  - La activación la hace Stripe (o el admin desde su panel); las reglas de
 *    Firestore impiden que un coach se extienda la suscripción a sí mismo.
 */

/**
 * Alta única, en euros.
 *
 * Un euro no financia nada: financia la IDENTIFICACIÓN. Al cobrarlo con
 * tarjeta, Stripe devuelve una huella del medio de pago que es la misma para
 * la misma tarjeta en cualquier cuenta, correo o dispositivo. Es lo que
 * permite que un entrenador no pueda multiplicarse en cuentas de cinco alumnos
 * para no pagar los 180 €, y no cuesta ni un paso más al que va de frente:
 * ya estaba metiendo la tarjeta.
 */
export const ENTRY_PRICE_EUR = 1;
export const ANNUAL_PRICE_EUR = 180;
/**
 * Lo que sale al mes el plan del entrenador.
 *
 * Se enseña este número y no los 180 porque es el que se compara con lo que
 * cobra por UN alumno: 180 de golpe parece una inversión, 15 al mes parece lo
 * que es. Debajo va SIEMPRE, sin excepción, que el cobro es anual y de una
 * vez: enseñar el mensual y cobrar el anual sin decirlo es lo que hace que la
 * gente pida la devolución y se vaya.
 */
export const COACH_MONTHLY_EQUIV_EUR = Math.round(ANNUAL_PRICE_EUR / 12);

/** Atleta individual: cuota mensual (suelta, no anual). */
export const ATHLETE_MONTHLY_EUR = 10;

/**
 * Estas cuatro viven en lib/planBase.ts y se reexportan aquí.
 *
 * El motivo: este fichero lee `Platform.OS` al cargarse, así que todo lo que
 * lo importe arrastra React Native entera y no se puede probar en Node pelado.
 * Sacarlas permite comprobar quién tiene acceso sin montar media app; dejarlas
 * reexportadas evita tocar los treinta sitios que ya las importaban de aquí.
 */
export { ADMIN_EMAILS, clientSlotsOf, DAY_MS, FREE_CLIENT_LIMIT } from './planBase';

/**
 * Payment Links de Stripe para las suscripciones de plataforma. Se crean en el
 * panel de Stripe (Payments → Payment Links) a partir de sus precios recurrentes
 * y se pegan aquí. La app los abre añadiendo ?client_reference_id=<uid> para que
 * el webhook active la cuenta correcta automáticamente.
 *   - Coach: precio 180 €/año  (price_1TwQhVKGNohj8zznoTrUubCg)
 *   - Atleta: precio 10 €/mes   (price_1TwQi6KGNohj8zznn54uw7mC)
 */
export const COACH_PAYMENT_LINK: string = 'https://buy.stripe.com/test_aFa5kEcao8277On4as7g401';
export const ATHLETE_PAYMENT_LINK: string = 'https://buy.stripe.com/test_14A7sM2zO8275Gf6iA7g400';

/**
 * Enlaces del ALTA de 1 € (pago único), uno por rol.
 *
 * Son los MISMOS dos que se pegan en `web/config.js`: la web los usa para quien
 * llega de fuera y la app para quien se registró sin pasar por ella. Si cambias
 * uno, cambia el otro.
 */
export const COACH_ENTRY_LINK: string =
  'https://buy.stripe.com/test_cNi5kEdescin1pZ4as7g403';
export const ATHLETE_ENTRY_LINK: string =
  'https://buy.stripe.com/test_cNi3cw3DScin9WvbCU7g402';

/** Enlace del alta con el uid dentro, para que el webhook sepa a quién activar. */
export function entryCheckoutUrl(profile: UserProfile | null): string | null {
  if (!profile) return null;
  const base = profile.role === 'athlete' ? ATHLETE_ENTRY_LINK : COACH_ENTRY_LINK;
  if (!base) return null;
  const sep = base.includes('?') ? '&' : '?';
  return (
    `${base}${sep}client_reference_id=${encodeURIComponent(profile.uid)}` +
    `&prefilled_email=${encodeURIComponent(profile.email)}`
  );
}

/**
 * Desde cuándo se exige el alta de 1 €.
 *
 * Las cuentas anteriores no la pagan nunca: cambiar las reglas a mitad de
 * partida y dejar fuera a quien ya estaba dentro es la forma más rápida de
 * perder a los primeros, que son justo los que menos merecen perderse.
 */
export const ENTRY_REQUIRED_FROM = Date.parse('2026-08-03T00:00:00Z');

/**
 * ¿Le falta pagar el alta a esta cuenta?
 *
 * Solo a quien paga plataforma (entrenador y atleta) y solo si se registró
 * después de que existiera el alta. El alumno de un coach no paga nunca.
 */
export function needsEntryPayment(profile: UserProfile | null): boolean {
  if (!profile) return false;
  if (profile.role !== 'trainer' && profile.role !== 'athlete') return false;
  if (isAdmin(profile)) return false;
  if (profile.entryPaidAt) return false;
  // Cuenta fundadora: existía antes de que hubiera alta.
  if ((profile.createdAt ?? 0) < ENTRY_REQUIRED_FROM) return false;
  // Estar de prueba NO exime: la prueba es justo lo que compra el euro. Solo se
  // salta el alta quien ya paga una suscripción de verdad (o a quien se le ha
  // extendido el acceso a mano), porque a ese ya se le conoce la tarjeta.
  const estado = subscriptionState(profile);
  return !estado.active || estado.trial;
}

/** Endpoint de comprobación bajo demanda (Vercel). Activa la cuenta al momento. */
export const CHECK_SUB_URL = 'https://udeca.vercel.app/api/check-subscription';

/** Endpoint que recoge un alta pagada en la web antes de existir la cuenta. */
export const CLAIM_ENTRY_URL = 'https://udeca.vercel.app/api/claim-entry';

/**
 * Reclama el alta pagada desde la web.
 *
 * Quien paga en udeca.app lo hace ANTES de tener cuenta, así que ese euro
 * queda apuntado a su correo. Al registrarse, esto lo recoge y activa la
 * cuenta; sin ello, la app le pediría pagar por segunda vez.
 *
 * Se manda el token de sesión de Firebase, no el uid: el servidor tiene que
 * poder comprobar que quien reclama el pago es de verdad el dueño de ese
 * correo, y un uid suelto no demuestra nada.
 */
export async function claimEntryNow(
  idToken: string
): Promise<{ activa: boolean; motivo?: string }> {
  try {
    const res = await fetch(CLAIM_ENTRY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: '{}',
    });
    return (await res.json()) as { activa: boolean; motivo?: string };
  } catch (e) {
    return { activa: false, motivo: e instanceof Error ? e.message : 'Error de red' };
  }
}

/**
 * Pregunta a Stripe (vía backend) si el email del usuario tiene suscripción
 * activa y, si la hay, activa la cuenta. Devuelve el motivo si no puede.
 */
export async function verifySubscriptionNow(
  profile: UserProfile | null
): Promise<{ active: boolean; reason?: string }> {
  if (!profile) return { active: false, reason: 'Sin perfil' };
  try {
    const res = await fetch(CHECK_SUB_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: profile.uid, email: profile.email }),
    });
    const data = (await res.json()) as { active: boolean; reason?: string };
    return data;
  } catch (e) {
    return { active: false, reason: e instanceof Error ? e.message : 'Error de red' };
  }
}

/** URL de suscripción para este usuario, con su uid para la activación auto. */
export function subscriptionCheckoutUrl(profile: UserProfile | null): string | null {
  if (!profile) return null;
  const base = profile.role === 'athlete' ? ATHLETE_PAYMENT_LINK : COACH_PAYMENT_LINK;
  if (!base) return null;
  const sep = base.includes('?') ? '&' : '?';
  return (
    `${base}${sep}client_reference_id=${encodeURIComponent(profile.uid)}` +
    `&prefilled_email=${encodeURIComponent(profile.email)}`
  );
}

/**
 * ¿Se puede vender la plataforma DENTRO de la app?
 *
 * En iPhone y iPad, no. La norma 3.1.1 de la App Store obliga a que todo lo
 * digital que se use dentro se compre con las compras integradas de Apple, y
 * prohíbe además enseñar precios o enlaces que lleven a pagar por fuera: una
 * pantalla con "180 €/año" y un botón a Stripe es rechazo seguro, y ni siquiera
 * es discutible. Lo que sí está permitido —y es lo que hacen Netflix, Spotify o
 * Notion— es que la cuenta se gestione fuera y la app se limite a decir que no
 * está activa, sin precio, sin enlace y sin explicar dónde pagar.
 *
 * Fuera de iOS (Android, web, APK) se cobra con normalidad por la web.
 *
 * Esto NO afecta a lo que un alumno le paga a su entrenador: eso es un servicio
 * real entre dos personas, no contenido digital, y Apple lo deja fuera de las
 * compras integradas expresamente.
 *
 * La solución definitiva en iOS son las compras integradas, que son otro
 * proyecto (StoreKit + acuerdos de pago en App Store Connect).
 */
export const CAN_SELL_IN_APP = Platform.OS !== 'ios';

/** Correo de contacto para activar/renovar manualmente. */
export const CONTACT_EMAIL = 'luistenaf@gmail.com';

export { isAdmin } from './planBase';

/**
 * Días de prueba al crear una cuenta de ATLETA. Se entra sin tarjeta: primero
 * se usa el producto y luego se decide. El entrenador no lleva prueba por
 * tiempo: su plan gratuito se mide en alumnos (ver FREE_CLIENT_LIMIT), que no
 * caduca mientras su grupo sea pequeño.
 *
 * Son 14 y no 7 porque en calistenia dos semanas es lo mínimo para completar
 * un par de ciclos de entrenamiento y notar algo. Con una semana la decisión
 * se toma sin haber llegado a usar el producto de verdad.
 *
 * Este número está también en firestore.rules (que impide pedir más prueba de
 * la que toca al crear la cuenta). Si lo cambias, cámbialo en los dos sitios.
 */
export const TRIAL_DAYS = 14;

/**
 * Días de margen desde que le vence la cuota a un alumno hasta que se le
 * bloquea la app. Cinco: los suficientes para que un despiste o un fin de
 * semana no le dejen fuera, y pocos para que el coach no acabe regalando un
 * mes de trabajo.
 */
export const CLIENT_GRACE_DAYS = 5;

/**
 * Margen extra desde que el alumno declara "ya he pagado" hasta que el bloqueo
 * vuelve si el coach no lo confirma.
 *
 * Sin esto, quien paga por transferencia un viernes se queda fuera hasta que
 * su coach entre a confirmarlo, que es castigar justo a quien ha cumplido.
 * Con tope, porque si no bastaría con declarar un pago falso para tener la app
 * gratis para siempre.
 */
export const CLIENT_REPORT_GRACE_DAYS = 3;

/**
 * ¿Está el alumno bloqueado por impago?
 *
 * Solo aplica a alumnos de un coach con cuota puesta. No bloquea a quien está
 * de prueba o de cortesía, ni a quien no tiene cuota (0 €): en esos casos no
 * hay nada que cobrar y bloquear sería un error de la app, no un impago.
 */
export function clientIsLocked(profile: UserProfile | null, now: number = Date.now()): boolean {
  if (!profile || profile.role !== 'client') return false;
  if (!profile.trainerId) return false;
  if (!profile.nextPaymentDate) return false;
  if (!profile.monthlyFeeEur) return false;
  if (profile.paymentStatus === 'free' || profile.paymentStatus === 'trial') return false;
  if (profile.paymentStatus === 'paid' && profile.nextPaymentDate > now) return false;
  // Ha dicho que ya pagó y aún está dentro del margen de confirmación.
  if (
    profile.paymentReportedAt &&
    now < profile.paymentReportedAt + CLIENT_REPORT_GRACE_DAYS * DAY_MS
  ) {
    return false;
  }
  return now > profile.nextPaymentDate + CLIENT_GRACE_DAYS * DAY_MS;
}

/** Días que le quedan al alumno antes de que se le bloquee la app (0 = hoy). */
export function clientDaysUntilLock(
  profile: UserProfile | null,
  now: number = Date.now()
): number | null {
  if (!profile || profile.role !== 'client' || !profile.nextPaymentDate) return null;
  if (!profile.monthlyFeeEur) return null;
  if (profile.paymentStatus === 'free' || profile.paymentStatus === 'trial') return null;
  const limite = profile.nextPaymentDate + CLIENT_GRACE_DAYS * DAY_MS;
  if (now >= limite) return 0;
  return Math.ceil((limite - now) / DAY_MS);
}

/** Fecha de fin de la prueba para una cuenta de atleta que se crea ahora. */
export function trialUntil(from: number = Date.now()): number {
  return from + TRIAL_DAYS * DAY_MS;
}

/**
 * La puerta de acceso vive en `planBase.ts` y se reexporta desde aquí para no
 * mover ni un import. Está allí porque este fichero lee `Platform.OS` al
 * cargarse, y eso deja las comprobaciones de Node fuera justo de la parte que
 * decide quién entra y quién ve el muro de pago.
 */
export {
  hasPlatformAccess,
  subscriptionState,
  trainerAtFreeLimit,
  trainerHasAccess,
  type SubscriptionState,
} from './planBase';
