import { Platform } from 'react-native';
import type { UserProfile } from './types';

/**
 * Stripe Connect de UDECA (cobros del coach a sus alumnos) SIN comisión de
 * plataforma. Todo pasa por un único endpoint en Vercel con tres acciones.
 * El coach ya paga su cuota anual, así que recibe el 100 % de lo que cobra
 * (menos las comisiones propias de Stripe, que asume él como cualquier negocio).
 */
export const CONNECT_URL = 'https://udeca.vercel.app/api/connect';

/** Origen al que Stripe devuelve tras el alta / pago (web usa la URL actual). */
function currentOrigin(): string {
  if (Platform.OS === 'web') {
    try {
      return window.location.origin;
    } catch {
      /* ignora */
    }
  }
  return 'https://www.udeca.app';
}

async function post<T>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(CONNECT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, origin: currentOrigin() }),
  });
  return (await res.json()) as T;
}

export interface ConnectStatus {
  ok: boolean;
  hasAccount: boolean;
  chargesEnabled: boolean;
  detailsSubmitted?: boolean;
  payoutsEnabled?: boolean;
  reason?: string;
}

/** Crea/recupera la cuenta del coach y devuelve el enlace de alta de Stripe. */
export async function startCoachOnboarding(
  profile: UserProfile | null
): Promise<{ ok: boolean; url?: string; reason?: string }> {
  if (!profile) return { ok: false, reason: 'Sin perfil' };
  try {
    return await post({ action: 'onboard', uid: profile.uid });
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'Error de red' };
  }
}

/** Consulta si el coach ya puede cobrar (y lo persiste en su perfil). */
export async function getConnectStatus(profile: UserProfile | null): Promise<ConnectStatus> {
  if (!profile) return { ok: false, hasAccount: false, chargesEnabled: false, reason: 'Sin perfil' };
  try {
    return await post<ConnectStatus>({ action: 'status', uid: profile.uid });
  } catch (e) {
    return {
      ok: false,
      hasAccount: false,
      chargesEnabled: false,
      reason: e instanceof Error ? e.message : 'Error de red',
    };
  }
}

/** Crea el pago del alumno a su coach y devuelve la URL de checkout de Stripe. */
export async function createCoachCheckoutUrl(
  coachId: string,
  clientId: string,
  amountEur: number
): Promise<{ ok: boolean; url?: string; reason?: string }> {
  try {
    return await post({ action: 'checkout', coachId, clientId, amountEur });
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'Error de red' };
  }
}
