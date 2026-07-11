import type { UserProfile } from './types';

/**
 * Modelo SaaS de UDECA: los COACHES pagan la plataforma; sus alumnos entran
 * gratis con el código del coach. Un único plan anual de momento.
 *
 *  - Al registrarse, cada coach recibe una prueba gratuita (TRIAL_DAYS).
 *  - Al caducar, el área del coach muestra el muro de suscripción (Paywall);
 *    sus datos NUNCA se tocan, solo se bloquea el acceso hasta renovar.
 *  - Cuentas sin `subscriptionUntil` = fundadoras (anteriores a la
 *    monetización): acceso completo para no romper nada.
 *  - La activación la hace el admin de UDECA desde su panel (y las reglas de
 *    Firestore impiden que un coach se la extienda a sí mismo).
 */
export const ANNUAL_PRICE_EUR = 180;
export const TRIAL_DAYS = 30;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Correos con poderes de administración de UDECA (gestión de suscripciones). */
export const ADMIN_EMAILS = ['luisetenete07@gmail.com'];

/**
 * Enlace de pago (Stripe Payment Link). Se crea en el panel de Stripe sin
 * programar nada y se pega aquí; hasta entonces el muro muestra el contacto.
 */
export const PAYMENT_LINK_URL = '';

/** Correo de contacto para activar/renovar manualmente. */
export const CONTACT_EMAIL = 'luisetenete07@gmail.com';

export function isAdmin(profile: UserProfile | null): boolean {
  return !!profile?.email && ADMIN_EMAILS.includes(profile.email.toLowerCase());
}

export interface SubscriptionState {
  /** true si el coach puede usar la plataforma. */
  active: boolean;
  /** Días restantes (redondeo hacia arriba), o null si es cuenta fundadora. */
  daysLeft: number | null;
  /** true si la cuenta es anterior a la monetización (sin fecha). */
  legacy: boolean;
  /** true si está dentro del periodo de prueba (nunca ha pagado un plan). */
  onTrial: boolean;
}

export function subscriptionState(profile: UserProfile | null): SubscriptionState {
  if (!profile || profile.role !== 'trainer') {
    return { active: true, daysLeft: null, legacy: true, onTrial: false };
  }
  if (isAdmin(profile)) return { active: true, daysLeft: null, legacy: false, onTrial: false };
  if (profile.subscriptionUntil === undefined) {
    return { active: true, daysLeft: null, legacy: true, onTrial: false };
  }
  const msLeft = profile.subscriptionUntil - Date.now();
  return {
    active: msLeft > 0,
    daysLeft: Math.max(0, Math.ceil(msLeft / DAY_MS)),
    legacy: false,
    onTrial: profile.subscriptionPlan !== 'annual',
  };
}

/** Fecha de fin de prueba para un coach recién registrado. */
export function trialEnd(): number {
  return Date.now() + TRIAL_DAYS * DAY_MS;
}
