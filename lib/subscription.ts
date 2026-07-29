import type { UserProfile } from './types';

/**
 * Modelo SaaS de UDECA: los COACHES pagan la plataforma; sus alumnos entran
 * gratis con el código del coach.
 *
 *  - ENTRENADOR: 180 €/año, con plan gratuito hasta FREE_CLIENT_LIMIT alumnos.
 *    Entra y usa la app entera desde el primer día; el muro solo aparece
 *    cuando su grupo supera el límite. Pedirle 180 € antes de haber visto el
 *    producto era el mayor punto de fuga del negocio.
 *  - ATLETA: 7 días de prueba y después 10 €/mes.
 *  - ALUMNO de un coach: gratis siempre.
 *  - Cuentas sin `subscriptionUntil` = fundadoras (anteriores a la
 *    monetización): acceso completo para no romper nada.
 *  - La activación la hace Stripe (o el admin desde su panel); las reglas de
 *    Firestore impiden que un coach se extienda la suscripción a sí mismo.
 */
export const ANNUAL_PRICE_EUR = 180;
/**
 * Alumnos que un entrenador puede tener sin pagar. Suficiente para probar el
 * producto con gente real; insuficiente para llevar un negocio con él.
 */
export const FREE_CLIENT_LIMIT = 2;
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
 */
export const TRIAL_DAYS = 7;

/** Etiqueta del plan del entrenador para las pantallas de venta. */
export const COACH_PLAN_LABEL = `Gratis hasta ${FREE_CLIENT_LIMIT} alumnos · ${ANNUAL_PRICE_EUR} €/año`;

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
