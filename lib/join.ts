import { auth } from './firebase';

/**
 * Vinculación alumno ↔ entrenador a través del servidor.
 *
 * El límite del plan gratuito se decide en el backend (ver
 * payments-webhook/api/join.js), que cuenta los alumnos de verdad con permisos
 * de administrador. La app solo pide; no decide. Así ni se puede falsear desde
 * un cliente modificado ni dos altas simultáneas pueden colar a un tercero.
 */

const JOIN_URL = 'https://udeca.vercel.app/api/join';

export interface JoinResult {
  ok: boolean;
  reason?: string;
  /** Solo en `sync`: recuento real de alumnos. */
  count?: number;
  full?: boolean;
}

async function call(body: Record<string, unknown>): Promise<JoinResult> {
  const user = auth.currentUser;
  if (!user) return { ok: false, reason: 'Sin sesión' };
  const idToken = await user.getIdToken();
  const res = await fetch(JOIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, idToken }),
  });
  return (await res.json()) as JoinResult;
}

/** El entrenador acepta a un alumno que solicitó entrar en su grupo. */
export async function approveClientOnServer(clientId: string): Promise<JoinResult> {
  return call({ action: 'approve', clientId });
}

/**
 * Recalcula en el servidor cuántos alumnos tiene el entrenador que llama.
 * Se usa tras quitar a alguien del grupo, para que el recuento que decide el
 * acceso no se quede alto de más.
 */
export async function syncClientCountOnServer(): Promise<JoinResult> {
  return call({ action: 'sync' });
}
