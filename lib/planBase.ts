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

/**
 * Cuentas con acceso permanente, SIN poderes de administración.
 *
 * Son las cuentas de la casa: la que se usa para enseñar la app, para grabar
 * los vídeos y para revisar de verdad lo que ve un atleta. No pagan y no
 * caducan nunca, porque una cuenta de demostración que se queda fuera a mitad
 * de una presentación es un problema en el peor momento posible.
 *
 * Va aparte de `ADMIN_EMAILS` a propósito, y no es un detalle: un admin puede
 * regalar suscripciones a cualquiera y las reglas de Firestore se lo permiten
 * (ver `isUdecaAdmin` en firestore.rules). Meter aquí una cuenta de escaparate
 * sería darle las llaves de la caja para ahorrarse una lista de cuatro líneas.
 *
 * Lo que da: se salta el muro de pago y el alta de 1 €. Nada más.
 */
export const CUENTAS_ILIMITADAS = ['udeca.app+atleta@gmail.com'];

/** ¿Es una de las cuentas de la casa, con acceso de por vida? */
export function accesoIlimitado(profile: UserProfile | null): boolean {
  return !!profile?.email && CUENTAS_ILIMITADAS.includes(profile.email.trim().toLowerCase());
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
  // Admins y cuentas de la casa: dentro siempre, sin cuenta atrás y sin
  // "estás de prueba". No es lo mismo que una cuenta fundadora (`legacy`):
  // aquella no tiene fecha porque es anterior al cobro; estas la tienen y da
  // igual lo que ponga.
  if (isAdmin(profile) || accesoIlimitado(profile)) {
    return { active: true, daysLeft: null, legacy: false, trial: false };
  }
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
  // Las cuentas de la casa tampoco pagan el euro: no son clientes, son la
  // app enseñándose a sí misma.
  if (isAdmin(profile) || accesoIlimitado(profile)) return false;
  if (profile.entryPaidAt) return false;
  // Cuenta fundadora: existía antes de que hubiera alta.
  if ((profile.createdAt ?? 0) < ENTRY_REQUIRED_FROM) return false;
  // Estar de prueba NO exime: la prueba es justo lo que compra el euro. Solo se
  // salta el alta quien ya paga una suscripción de verdad (o a quien se le ha
  // extendido el acceso a mano), porque a ese ya se le conoce la tarjeta.
  const estado = subscriptionState(profile);
  return !estado.active || estado.trial;
}
