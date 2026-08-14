import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProveedorDeEntrada } from './proveedores';
import type { UserRole } from './types';

/**
 * Las cuentas con las que ya se ha entrado en ESTE dispositivo.
 *
 * QUÉ SE ENSEÑA Y QUÉ NO. Se enseña la CARA y el NOMBRE, no el correo. Un
 * correo en la pantalla de entrar no ayuda a nadie a reconocerse —uno sabe
 * perfectamente cuál es su foto— y en cambio se lo enseña a quien mire el
 * móvil por encima del hombro. Ninguna app buena lo hace.
 *
 * PARA QUÉ SIRVE ENTONCES el correo, que sí se guarda: para que al tocar la
 * cuenta se entre DIRECTAMENTE con ella. Se le pasa a Google como `login_hint`
 * y a Apple le vale su propia sesión. Sin él habría que volver a elegir cuenta
 * en la pantalla del proveedor, que es justo el paso que sobra.
 *
 * NUNCA se guarda una credencial ni un token: esto es una lista de atajos, no
 * una sesión. La sesión la guarda Firebase por su cuenta, y por eso no hay que
 * entrar cada vez que se abre la app.
 */
export type { ProveedorDeEntrada } from './proveedores';
export { NOMBRE_DEL_PROVEEDOR, proveedorDe } from './proveedores';

export interface RememberedAccount {
  /** No se enseña: sirve para entrar directamente con esa cuenta. */
  email: string;
  name: string;
  role: UserRole;
  photoURL?: string;
  /** Con qué se entró la última vez. Decide qué botón hay que pulsar. */
  provider: ProveedorDeEntrada;
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
  provider?: ProveedorDeEntrada;
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
      // El proveedor solo se pisa si viene uno nuevo: al recargar el perfil no
      // se sabe con qué se entró, y sobrescribirlo con 'otro' dejaría el botón
      // sin saber a quién llamar.
      provider: acc.provider ?? prev?.provider ?? 'otro',
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
