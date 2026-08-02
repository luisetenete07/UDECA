import type { UserProfile } from './types';

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
 * Alumnos incluidos en el alta de 1 €. Suficiente para llevar un grupo
 * pequeño de verdad; insuficiente para vivir de ello sin pasar por caja.
 *
 * Es un TOPE POR DEFECTO, no una ley: el servidor puede rebajarlo por cuenta
 * (`clientSlots`) cuando detecta que ese euro ya se pagó con la misma tarjeta
 * en otra cuenta de entrenador. Cinco plazas por euro, una vez.
 *
 * OJO: este número está replicado en dos sitios más que no pueden importar
 * este fichero — payments-webhook/api/join.js (el servidor, que es quien
 * decide) y firestore.rules (que lo impone para las versiones antiguas de la
 * app). Si lo cambias, cámbialo en los tres.
 */
export const FREE_CLIENT_LIMIT = 5;

/** Plazas de alumno de esta cuenta: las del alta salvo que el servidor las baje. */
export function clientSlotsOf(profile: { clientSlots?: number } | null): number {
  const n = profile?.clientSlots;
  return typeof n === 'number' && n >= 0 ? n : FREE_CLIENT_LIMIT;
}
/** Atleta individual: cuota mensual (suelta, no anual). */
export const ATHLETE_MONTHLY_EUR = 10;
export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Correos con poderes de administración de UDECA (gestión de suscripciones).
 * Los admins tienen acceso completo de por vida (nunca pagan ni caducan).
 */
export const ADMIN_EMAILS = ['luisetenete07@gmail.com', 'luistenaf@gmail.com'];

/**
 * Enlace de pago (Stripe Payment Link). Se crea en el panel de Stripe sin
 * programar nada y se pega aquí; hasta entonces el muro muestra el contacto.
 */
export const PAYMENT_LINK_URL = '';

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

/** Endpoint de comprobación bajo demanda (Vercel). Activa la cuenta al momento. */
export const CHECK_SUB_URL = 'https://udeca.vercel.app/api/check-subscription';

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

/** Correo de contacto para activar/renovar manualmente. */
export const CONTACT_EMAIL = 'luistenaf@gmail.com';

export function isAdmin(profile: UserProfile | null): boolean {
  return !!profile?.email && ADMIN_EMAILS.includes(profile.email.toLowerCase());
}

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

/** Etiqueta del plan del entrenador para las pantallas de venta. */
export const COACH_PLAN_LABEL = `Hasta ${FREE_CLIENT_LIMIT} alumnos incluidos · ${ANNUAL_PRICE_EUR} €/año para más`;

/** Fecha de fin de la prueba para una cuenta de atleta que se crea ahora. */
export function trialUntil(from: number = Date.now()): number {
  return from + TRIAL_DAYS * DAY_MS;
}

export interface SubscriptionState {
  /** true si el coach puede usar la plataforma. */
  active: boolean;
  /** Días restantes (redondeo hacia arriba), o null si es cuenta fundadora. */
  daysLeft: number | null;
  /** true si la cuenta es anterior a la monetización (sin fecha). */
  legacy: boolean;
  /** true mientras se está dentro de la prueba gratuita (aún sin pagar). */
  trial: boolean;
}

/**
 * ¿Puede el entrenador usar la plataforma?
 *
 * Con suscripción activa, siempre. Sin ella, mientras su grupo no pase del
 * límite gratuito. Se mira `clientCount` del propio perfil (lo mantiene su app
 * al cargar la lista) para no tener que contar alumnos en cada arranque.
 */
export function trainerHasAccess(profile: UserProfile | null): boolean {
  if (!profile || profile.role !== 'trainer') return true;
  if (subscriptionState(profile).active) return true;
  return (profile.clientCount ?? 0) <= FREE_CLIENT_LIMIT;
}

/** true si el entrenador ya no puede sumar alumnos sin suscribirse. */
export function trainerAtFreeLimit(profile: UserProfile | null): boolean {
  if (!profile || profile.role !== 'trainer') return false;
  if (subscriptionState(profile).active) return false;
  return (profile.clientCount ?? 0) >= FREE_CLIENT_LIMIT;
}

export function subscriptionState(profile: UserProfile | null): SubscriptionState {
  // Pagan plataforma: entrenadores (anual) y atletas individuales (mensual).
  // Los alumnos vinculados a un coach entran gratis.
  if (!profile || (profile.role !== 'trainer' && profile.role !== 'athlete')) {
    return { active: true, daysLeft: null, legacy: true, trial: false };
  }
  if (isAdmin(profile)) return { active: true, daysLeft: null, legacy: false, trial: false };
  if (profile.subscriptionUntil === undefined) {
    return { active: true, daysLeft: null, legacy: true, trial: false };
  }
  const msLeft = profile.subscriptionUntil - Date.now();
  // Sigue siendo prueba mientras el acceso no se haya extendido más allá de la
  // fecha que se fijó al registrarse (al pagar, subscriptionUntil la supera).
  const trial =
    profile.trialEndsAt !== undefined && profile.subscriptionUntil <= profile.trialEndsAt;
  return {
    active: msLeft > 0,
    daysLeft: Math.max(0, Math.ceil(msLeft / DAY_MS)),
    legacy: false,
    trial,
  };
}
