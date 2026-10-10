import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

/**
 * El módulo nativo de pasos (modules/udeca-pasos).
 *
 *  - iPhone: Salud (HealthKit). Junta iPhone y Apple Watch sin contar dos veces
 *    lo mismo: la cifra es la que la persona ve en su app de Salud.
 *  - Android: la API de grabación de Google Play. Cuenta en segundo plano, con
 *    la app cerrada, sin Health Connect ni permisos de salud.
 *
 * Opcional a propósito: en la web, en Expo Go o en una versión instalada antes
 * de que existiera, no está, y la app sigue con lo de antes (el contador del
 * iPhone, el sensor de Android con la app abierta, o a mano).
 */
interface ModuloDePasos {
  disponible(): boolean;
  /** Solo iPhone: la hoja de permisos de Salud. */
  pedirPermiso?(): Promise<boolean>;
  /** Solo Android: empezar a grabar (repetirlo no hace nada). */
  suscribir?(): Promise<boolean>;
  /** Pasos entre dos instantes, en milisegundos. -1 si falla. */
  pasosEntre(desde: number, hasta: number): Promise<number>;
}

const modulo: ModuloDePasos | null =
  Platform.OS === 'web' ? null : requireOptionalNativeModule<ModuloDePasos>('UdecaPasos');

/** ¿Hay lectura del sistema (Salud o la grabación de Google)? */
export function hayPasosDelSistema(): boolean {
  try {
    return !!modulo && modulo.disponible();
  } catch {
    return false;
  }
}

/** iPhone: pedir permiso a Salud. En Android, suscribirse a la grabación. */
export async function prepararPasosDelSistema(): Promise<boolean> {
  if (!hayPasosDelSistema() || !modulo) return false;
  try {
    if (Platform.OS === 'ios') return (await modulo.pedirPermiso?.()) ?? false;
    return (await modulo.suscribir?.()) ?? false;
  } catch {
    return false;
  }
}

/** Pasos entre dos instantes según el sistema; `null` si no se pudo leer. */
export async function pasosDelSistema(desde: number, hasta: number): Promise<number | null> {
  if (!hayPasosDelSistema() || !modulo) return null;
  try {
    const n = await modulo.pasosEntre(desde, hasta);
    return typeof n === 'number' && n >= 0 ? Math.round(n) : null;
  } catch {
    return null;
  }
}
