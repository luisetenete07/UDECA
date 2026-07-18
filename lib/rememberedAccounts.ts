import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserRole } from './types';

/**
 * Cuentas recordadas en ESTE dispositivo. Guardamos solo datos no sensibles
 * (correo, nombre, rol, foto) para que quien comparte el dispositivo pueda
 * elegir con quién entrar sin teclear el correo. NUNCA guardamos la
 * contraseña: al elegir una cuenta, se pide la contraseña (seguridad).
 */
export interface RememberedAccount {
  email: string;
  name: string;
  role: UserRole;
  photoURL?: string;
  lastUsed: number;
}

const KEY = 'udeca-accounts';
const MAX = 6;

export async function getRememberedAccounts(): Promise<RememberedAccount[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as RememberedAccount[];
    return Array.isArray(list) ? list.sort((a, b) => b.lastUsed - a.lastUsed) : [];
  } catch {
    return [];
  }
}

/**
 * Añade o actualiza una cuenta recordada (por correo). Fusiona con lo ya
 * guardado: así se puede recordar el correo en cuanto hay sesión (aunque el
 * perfil aún no haya cargado) y completar nombre/rol/foto después sin perder
 * los datos anteriores.
 */
export async function rememberAccount(acc: {
  email: string;
  name?: string;
  role?: UserRole;
  photoURL?: string;
}): Promise<void> {
  try {
    const list = await getRememberedAccounts();
    const email = acc.email.trim().toLowerCase();
    if (!email) return;
    const prev = list.find((a) => a.email === email);
    const next: RememberedAccount = {
      email,
      name: acc.name?.trim() || prev?.name || email.split('@')[0],
      role: acc.role || prev?.role || 'client',
      photoURL: acc.photoURL ?? prev?.photoURL,
      lastUsed: Date.now(),
    };
    const filtered = list.filter((a) => a.email !== email);
    const merged = [next, ...filtered].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    // Recordar cuentas es una comodidad: si falla, no pasa nada.
  }
}

export async function forgetAccount(email: string): Promise<void> {
  try {
    const list = await getRememberedAccounts();
    const filtered = list.filter((a) => a.email !== email.trim().toLowerCase());
    await AsyncStorage.setItem(KEY, JSON.stringify(filtered));
  } catch {
    // Ignorar.
  }
}
