import {
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  linkWithCredential,
  signInWithEmailAndPassword,
  type AuthCredential,
} from 'firebase/auth';
import { auth } from './firebase';

/**
 * Rescatar una cuenta que se creó con contraseña.
 *
 * EL PROBLEMA, que conviene entender antes de tocar nada. Una cuenta de
 * Firebase NO es un correo: es un identificador (uid). Todo lo que esta app
 * guarda de alguien —su perfil, sus rutinas, sus entrenos, sus cobros— cuelga
 * de ese uid. Dos cuentas con el mismo correo pero distinto uid son dos
 * personas distintas para la base de datos, y la segunda nace vacía.
 *
 * Al quitar la contraseña como forma de entrar, quien ya tenía cuenta así
 * pulsa "Entrar con Google". Y ahí Firebase NO enlaza solo: con "una cuenta
 * por dirección de correo" (lo que trae de fábrica) rechaza la entrada con
 * `auth/account-exists-with-different-credential`. Si nadie recoge ese error,
 * esa persona se queda fuera de su propia cuenta y sus datos quedan
 * huérfanos. Es el peor fallo posible de esta migración y es silencioso.
 *
 * LA SOLUCIÓN es este módulo: cuando pasa eso, se le pide la contraseña UNA
 * última vez, se entra con ella y se ENLAZA la credencial de Google (o de
 * Apple) a esa misma cuenta. Mismo uid, mismos datos, y a partir de entonces
 * entra con Google para siempre. La contraseña desaparece de la pantalla de
 * entrar; sobrevive solo aquí, como puerta de rescate.
 *
 * (Hay un caso en que Firebase sí enlaza solo: si la cuenta con contraseña
 * tenía el correo SIN verificar, la entrada con Google —que sí lo verifica— se
 * queda con la cuenta y tira la contraseña. Conserva el uid, así que también
 * está bien. Pero no se puede saber de antemano a quién le tocará cada camino,
 * y por eso hace falta el de aquí.)
 */

/** El error que dice "esta cuenta ya existe, pero con otro método". */
export const CODIGO_OTRO_METODO = 'auth/account-exists-with-different-credential';

/** ¿Es ese error, el que hay que rescatar en vez de enseñar? */
export function esCuentaConOtroMetodo(e: unknown): boolean {
  return (e as { code?: string })?.code === CODIGO_OTRO_METODO;
}

/** El correo de la cuenta que ya existía, que Firebase manda dentro del error. */
export function correoDelError(e: unknown): string {
  const datos = (e as { customData?: { email?: string } })?.customData;
  return (datos?.email ?? '').trim();
}

/**
 * La credencial que se quedó a medias, para poder engancharla luego.
 *
 * Firebase la mete dentro del error, pero hay que sacarla con el proveedor que
 * toca. Se prueban los dos que ofrecemos: no viene dicho cuál era.
 */
export function credencialDelError(e: unknown): AuthCredential | null {
  try {
    const google = GoogleAuthProvider.credentialFromError(e as never);
    if (google) return google;
  } catch {
    /* no era de Google */
  }
  try {
    return OAuthProvider.credentialFromError(e as never);
  } catch {
    return null;
  }
}

export interface ResultadoDeEnlace {
  ok: boolean;
  /** Qué decirle si no ha salido. */
  motivo?: string;
}

/**
 * Entra con la contraseña de siempre y engancha el método nuevo.
 *
 * El orden importa y no es intercambiable: primero se demuestra que la cuenta
 * es suya (con la contraseña) y después se le añade Google. Al revés sería
 * dejar que cualquiera se enganche a una cuenta ajena diciendo que ese correo
 * es suyo.
 */
export async function enlazarConContrasena(
  email: string,
  password: string,
  pendiente: AuthCredential | null
): Promise<ResultadoDeEnlace> {
  const correo = email.trim();
  if (!correo || !password) return { ok: false, motivo: 'Escribe tu contraseña de siempre.' };
  try {
    const sesion = await signInWithEmailAndPassword(auth, correo, password);
    if (pendiente) {
      try {
        await linkWithCredential(sesion.user, pendiente);
      } catch (e) {
        // Ya enlazada de antes: no es un fallo, es que ya estaba hecho.
        if ((e as { code?: string })?.code !== 'auth/provider-already-linked') throw e;
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: mensajeDeEntrada(e) };
  }
}

/**
 * Añade la contraseña a la cuenta que hay abierta.
 *
 * No se usa en la pantalla de entrar: es la salida de emergencia para quien
 * entró con Apple y "Ocultar mi correo", que se queda con una dirección de
 * rebote que no lee nadie. Con esto puede fijar un correo suyo y una
 * contraseña, y no depender de un buzón que Apple puede desactivar.
 */
export async function anadirContrasena(
  email: string,
  password: string
): Promise<ResultadoDeEnlace> {
  const user = auth.currentUser;
  if (!user) return { ok: false, motivo: 'Sin sesión' };
  try {
    await linkWithCredential(user, EmailAuthProvider.credential(email.trim(), password));
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: mensajeDeEntrada(e) };
  }
}

/**
 * El error de Firebase, dicho como se lo diría una persona.
 *
 * Los códigos crudos ("auth/wrong-password") no ayudan a nadie, y el mensaje
 * en inglés que trae dentro, tampoco.
 */
export function mensajeDeEntrada(e: unknown): string {
  const codigo = (e as { code?: string })?.code ?? '';
  if (/wrong-password|invalid-credential|invalid-login/.test(codigo)) {
    return 'Esa contraseña no es. Si no te acuerdas, pide restablecerla desde abajo.';
  }
  if (codigo.includes('user-not-found')) return 'No hay ninguna cuenta con ese correo.';
  if (codigo.includes('too-many-requests')) {
    return 'Demasiados intentos seguidos. Espera un momento y vuelve a probar.';
  }
  if (codigo.includes('network-request-failed')) return 'Sin conexión. Inténtalo de nuevo.';
  if (codigo.includes('email-already-in-use')) return 'Ese correo ya está en otra cuenta.';
  if (codigo.includes('weak-password')) return 'La contraseña necesita al menos 6 caracteres.';
  if (codigo.includes('invalid-email')) return 'Ese correo no parece válido.';
  return e instanceof Error && e.message ? e.message : 'No se ha podido entrar.';
}
