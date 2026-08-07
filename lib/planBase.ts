import type { UserProfile } from './types';

/**
 * Las piezas del plan que no dependen de React Native.
 *
 * Salieron de `lib/subscription.ts` por un motivo concreto: ese fichero lee
 * `Platform.OS` en cuanto se carga, así que cualquier cosa que lo importe
 * arrastra React Native entera. Eso deja fuera a las comprobaciones —que
 * corren en Node pelado— justo en la parte del código donde más falta hacen:
 * la que decide quién tiene acceso y quién paga.
 *
 * Aquí no hay nada nuevo. `subscription.ts` las reexporta, así que todo lo que
 * ya las importaba de allí sigue funcionando igual; simplemente ahora hay un
 * único sitio donde viven y se pueden probar sin trucos.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Alumnos incluidos en el alta de 1 € del entrenador.
 *
 * Este número vive en TRES sitios que no pueden importarse entre sí: aquí,
 * payments-webhook/api/join.js (el servidor, que es quien decide) y
 * firestore.rules (que lo impone para las versiones antiguas de la app). Si lo
 * cambias, cámbialo en los tres.
 */
export const FREE_CLIENT_LIMIT = 5;

/** Plazas de alumno de esta cuenta: las del alta salvo que el servidor las baje. */
export function clientSlotsOf(profile: { clientSlots?: number } | null): number {
  const n = profile?.clientSlots;
  return typeof n === 'number' && n >= 0 ? n : FREE_CLIENT_LIMIT;
}

/**
 * Correos con poderes de administración de UDECA (gestión de suscripciones).
 * Los admins tienen acceso completo de por vida (nunca pagan ni caducan).
 */
export const ADMIN_EMAILS = ['luisetenete07@gmail.com', 'luistenaf@gmail.com'];

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
  /** true mientras se está dentro de la prueba gratuita (aún sin pagar). */
  trial: boolean;
}

export function subscriptionState(
  profile: UserProfile | null,
  now: number = Date.now()
): SubscriptionState {
  // Pagan plataforma: entrenadores (anual) y atletas individuales (mensual).
  // Los alumnos vinculados a un coach entran gratis.
  if (!profile || (profile.role !== 'trainer' && profile.role !== 'athlete')) {
    return { active: true, daysLeft: null, legacy: true, trial: false };
  }
  if (isAdmin(profile)) return { active: true, daysLeft: null, legacy: false, trial: false };
  if (profile.subscriptionUntil === undefined) {
    return { active: true, daysLeft: null, legacy: true, trial: false };
  }
  const msLeft = profile.subscriptionUntil - now;
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

/**
 * ¿Puede el entrenador usar la plataforma?
 *
 * Con suscripción activa, siempre. Sin ella, mientras su grupo no pase del
 * límite gratuito. Se mira `clientCount` del propio perfil (lo mantiene su app
 * al cargar la lista) para no tener que contar alumnos en cada arranque.
 */
export function trainerHasAccess(profile: UserProfile | null, now: number = Date.now()): boolean {
  if (!profile || profile.role !== 'trainer') return true;
  if (subscriptionState(profile, now).active) return true;
  return (profile.clientCount ?? 0) <= clientSlotsOf(profile);
}

/** true si el entrenador ya no puede sumar alumnos sin suscribirse. */
export function trainerAtFreeLimit(profile: UserProfile | null, now: number = Date.now()): boolean {
  if (!profile || profile.role !== 'trainer') return false;
  if (subscriptionState(profile, now).active) return false;
  return (profile.clientCount ?? 0) >= clientSlotsOf(profile);
}

/**
 * ¿Ve esta cuenta la app, o ve el muro de pago?
 *
 * Es LA puerta, y por eso está escrita una sola vez. Antes vivía repartida
 * entre los dos layouts —`trainerHasAccess` en el del entrenador,
 * `subscriptionState().active` en el del alumno— y cualquier tercero que
 * quisiera saber si alguien está dentro (la insignia de fundador, por ejemplo)
 * tenía que volver a montar el mismo `if` y confiar en no equivocarse. Dos
 * copias de una regla son dos reglas en cuanto alguien toca una.
 */
export function hasPlatformAccess(profile: UserProfile | null, now: number = Date.now()): boolean {
  if (!profile) return true;
  if (profile.role === 'trainer') return trainerHasAccess(profile, now);
  if (profile.role === 'athlete') return subscriptionState(profile, now).active;
  // Alumno de un coach: entra gratis por definición.
  return true;
}
