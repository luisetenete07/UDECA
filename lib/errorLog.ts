import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { addDoc, collection } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Registro de errores reales de los usuarios.
 *
 * Hasta ahora, cuando algo se rompía en el móvil de un alumno no nos
 * enterábamos: él veía la pantalla de "Algo no ha ido bien" y, como mucho,
 * escribía por WhatsApp. Aquí guardamos cada fallo en Firestore para poder
 * verlo desde la propia app (Perfil → Errores recientes, solo CEO).
 *
 * Deliberadamente NO usamos un servicio externo tipo Sentry: eso exige un
 * módulo nativo más, y un módulo nativo mal enlazado es justo lo que provocó
 * el rechazo de Apple. Esto cubre los fallos de JavaScript —la inmensa mayoría
 * de lo que se rompe— sin tocar el binario. Si algún día hacen falta crashes
 * nativos con símbolos, Sentry es el siguiente paso.
 */

export interface ErrorLogInput {
  message: string;
  stack?: string;
  /** Dónde ocurrió: ruta de expo-router o nombre de la operación. */
  where?: string;
  /** Usuario afectado, si había sesión. */
  uid?: string;
  /** true si tumbó la pantalla; false si fue un fallo recuperable. */
  fatal?: boolean;
}

/** Recortes duros: un stack enorme multiplicado por miles de usuarios cuesta. */
const MAX_MESSAGE = 300;
const MAX_STACK = 2000;

/** Evita inundar la colección si algo falla en bucle (p. ej. en un render). */
const recent = new Map<string, number>();
const DEDUPE_MS = 60_000;

const appVersion =
  (Constants.expoConfig?.version as string | undefined) ?? 'desconocida';

/**
 * Guarda un error. Nunca lanza: si falla el propio registro (sin red, sin
 * permisos…), se traga el fallo — informar de un error jamás puede provocar
 * otro error encima del que ya está sufriendo el usuario.
 */
export async function logError(input: ErrorLogInput): Promise<void> {
  try {
    const message = String(input.message ?? '').slice(0, MAX_MESSAGE);
    if (!message) return;

    // Mismo error repetido en menos de un minuto: se cuenta una sola vez.
    const key = `${message}|${input.where ?? ''}`;
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < DEDUPE_MS) return;
    recent.set(key, now);

    await addDoc(collection(db, 'errorLogs'), {
      message,
      stack: input.stack ? String(input.stack).slice(0, MAX_STACK) : undefined,
      where: input.where ?? 'desconocido',
      uid: input.uid ?? null,
      fatal: input.fatal ?? false,
      platform: Platform.OS,
      appVersion,
      createdAt: now,
    });
  } catch {
    // Silencio intencionado: ver el comentario de arriba.
  }
}

/** Normaliza cualquier cosa lanzada (Error, string, objeto raro) a texto. */
export function describeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message || error.name, stack: error.stack };
  }
  if (typeof error === 'string') return { message: error };
  try {
    return { message: JSON.stringify(error).slice(0, MAX_MESSAGE) };
  } catch {
    return { message: 'Error no identificado' };
  }
}

/**
 * Engancha el manejador global de errores no capturados. Cubre los fallos que
 * ocurren fuera del render (callbacks, promesas sueltas), que el ErrorBoundary
 * de React no puede ver.
 */
export function installGlobalErrorLogging(getUid: () => string | undefined): void {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.addEventListener('error', (event) => {
      const { message, stack } = describeError(event.error ?? event.message);
      void logError({ message, stack, where: window.location?.pathname, uid: getUid(), fatal: true });
    });
    window.addEventListener('unhandledrejection', (event) => {
      const { message, stack } = describeError(event.reason);
      void logError({ message, stack, where: window.location?.pathname, uid: getUid() });
    });
    return;
  }

  // En nativo el manejador es global de RN; encadenamos al que ya hubiera para
  // no robarle el control a la pantalla roja de desarrollo.
  const globalAny = globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
      setGlobalHandler: (fn: (error: unknown, isFatal?: boolean) => void) => void;
    };
  };
  const handlers = globalAny.ErrorUtils;
  if (!handlers) return;
  const previous = handlers.getGlobalHandler();
  handlers.setGlobalHandler((error, isFatal) => {
    const { message, stack } = describeError(error);
    void logError({ message, stack, uid: getUid(), fatal: !!isFatal });
    previous(error, isFatal);
  });
}
