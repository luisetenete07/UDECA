import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, increment, setDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Analítica del embudo: descarga → intro → registro → pago.
 *
 * Hemos estado reduciendo la fricción de pago a ciegas, sin saber en qué paso
 * concreto se cae la gente. Esto lo mide.
 *
 * Diseño: NO se guarda un documento por evento (eso dispara el coste y la
 * colección se vuelve inmanejable), sino un ÚNICO documento por día con un
 * contador por evento, sumado con `increment`. Un mes entero son 30 lecturas.
 *
 * Tampoco se guarda nada personal: solo cuántas veces pasó cada cosa. No hay
 * identificadores de usuario, así que no hay nada que anonimizar después.
 */

/**
 * Pasos del embudo. Esta lista es la fuente de verdad y está replicada en
 * firestore.rules: si añades uno aquí, añádelo también allí o se rechazará
 * la escritura.
 */
export const FUNNEL_EVENTS = [
  'intro_start', // abre la app por primera vez y ve la intro
  'intro_done', // termina la intro (o la salta) y llega al alta
  'register_view', // abre la pantalla de registro
  'register_submit', // pulsa "crear cuenta"
  'register_ok', // la cuenta se crea
  'register_fail', // el alta falla (validación o error del servidor)
  'register_ok_trainer',
  'register_ok_athlete',
  'register_ok_client',
  'login_ok',
  'entry_wall_view', // se topa con el alta de 1 € al entrar por primera vez
  'paywall_view', // un coach se topa con el muro de pago
  'checkout_start', // pulsa pagar (el mensual, o el único que haya)
  'checkout_start_anual', // el atleta elige pagar el año en vez del mes
] as const;

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

/** Clave donde se recuerda qué pasos ya contó ESTE dispositivo. */
const ONCE_KEY = 'udeca.analytics.once.v1';

/** Día natural en formato AAAA-MM-DD, en la zona horaria del dispositivo. */
function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Suma uno al contador del evento. Nunca lanza: la analítica jamás puede
 * romper —ni ralentizar— lo que el usuario está intentando hacer.
 */
export async function track(event: FunnelEvent): Promise<void> {
  try {
    await setDoc(
      doc(db, 'analytics', today()),
      { [event]: increment(1), updatedAt: Date.now() },
      { merge: true }
    );
  } catch {
    // Silencio intencionado.
  }
}

/**
 * Cuenta el evento UNA sola vez por dispositivo. Es lo que hace que los
 * porcentajes signifiquen algo: si alguien abre el registro cinco veces, el
 * embudo no debe decir que hubo cinco personas interesadas.
 */
export async function trackOnce(event: FunnelEvent): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(ONCE_KEY);
    const seen: string[] = raw ? JSON.parse(raw) : [];
    if (seen.includes(event)) return;
    await AsyncStorage.setItem(ONCE_KEY, JSON.stringify([...seen, event]));
    await track(event);
  } catch {
    // Silencio intencionado.
  }
}
