import { coachingDe, DIAS_DE_MARGEN } from './coaching';
import type { UserProfile } from './types';

/**
 * Quién entra y quién no, sin depender de React Native.
 *
 * Antes este fichero era el corazón del cobro de la plataforma: la prueba de
 * catorce días, el alta del primer año, las plazas de alumno y el muro de pago
 * de cada entrenador. Todo eso se fue con la app de un solo coach: Maestría en
 * Calistenia no le cobra nada a nadie. Lo que queda es lo que sigue decidiendo
 * algo:
 *
 *  - Las cuentas de administración (las de Luis).
 *  - Si un alumno tiene la app en pausa porque se le acabó el periodo de
 *    coaching que le puso Luis (lib/coaching.ts).
 *
 * Sin imports de React Native a propósito: las comprobaciones corren en Node
 * pelado, y esta es justo la parte que decide quién ve la app.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Correos de las cuentas de administración: las de Luis. Ven los errores de la
 * app y pueden apuntarse como el coach (lib/coachUnico.ts).
 *
 * La misma lista está en firestore.rules (`isCalicoAdmin` y `config/coach`):
 * las reglas no pueden importar nada. Si la cambias, cámbiala en los dos.
 */
export const ADMIN_EMAILS = ['luisetenete07@gmail.com', 'luistenaf@gmail.com'];

export function isAdmin(profile: Pick<UserProfile, 'email'> | null): boolean {
  return !!profile?.email && ADMIN_EMAILS.includes(profile.email.toLowerCase());
}

/**
 * Días de margen desde que se acaba el periodo de coaching de un alumno hasta
 * que se le pausa la app (ver lib/coaching.ts).
 */
export const CLIENT_GRACE_DAYS = DIAS_DE_MARGEN;

/**
 * ¿Tiene el alumno la app en pausa porque se le acabó el periodo?
 *
 * Mira SOLO la fecha que pone su entrenador. La app no lleva dinero: lo único
 * que cuenta es hasta cuándo le ha dado acceso. Pedir la renovación avisa al
 * entrenador, pero no abre la puerta: si la abriera, bastaría con pulsarlo cada
 * tres días para no renovar nunca.
 *
 * Sin fecha no se pausa nunca, y tampoco a quien su entrenador dejó marcado
 * como gratis o de prueba con el sistema anterior.
 */
export function clientIsLocked(profile: UserProfile | null, now: number = Date.now()): boolean {
  if (!profile || profile.role !== 'client') return false;
  if (!profile.trainerId) return false;
  if (profile.paymentStatus === 'free' || profile.paymentStatus === 'trial') return false;
  return coachingDe(profile, now).estado === 'pausado';
}

/** Días que le quedan al alumno antes de que se le pause la app (0 = hoy). */
export function clientDaysUntilLock(
  profile: UserProfile | null,
  now: number = Date.now()
): number | null {
  if (!profile || profile.role !== 'client' || !profile.trainerId) return null;
  if (profile.paymentStatus === 'free' || profile.paymentStatus === 'trial') return null;
  return coachingDe(profile, now).diasParaPausa;
}
