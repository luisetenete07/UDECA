import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { OAuthProvider, signInWithCredential, signInWithPopup, type UserCredential } from 'firebase/auth';
import { auth } from './firebase';

/**
 * Entrar con Apple.
 *
 * No es un capricho ni una alternativa más: Apple OBLIGA a ofrecer "Sign in
 * with Apple" a toda app que ofrezca otro inicio de sesión de terceros. Con el
 * botón de Google puesto y este no, la app se rechaza en la revisión. Así que
 * esto es tan parte de poder publicar como el icono o la política de
 * privacidad.
 *
 * Dos caminos, por el mismo motivo que en Google:
 *
 *  - En iOS lo pide el sistema (`expo-apple-authentication`): sale la hoja
 *    nativa con Face ID y devuelve un identity token que se le pasa a Firebase.
 *  - En web, Firebase abre la ventana de Apple él mismo.
 *  - En Android no se ofrece. Se podría por web, pero exige montar un Services
 *    ID y un dominio de retorno en Apple, y allí ya está Google, que es lo que
 *    usa todo el mundo. Un botón que no está es mejor que uno que falla.
 *
 * EL NONCE, que es lo único delicado: Apple firma el token contra un número de
 * un solo uso, y Firebase necesita el ORIGINAL para comprobar la firma. Se
 * genera uno, se le manda a Apple su SHA-256 y a Firebase el original. Sin
 * esto, Firebase rechaza la credencial con un error que no dice por qué.
 */

/** Letras y números para el número de un solo uso. Sin símbolos: Apple los digiere mal. */
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Un nonce nuevo, aleatorio de verdad (no Math.random). */
function nuevoNonce(largo = 32): string {
  const bytes = Crypto.getRandomBytes(largo);
  let salida = '';
  for (const b of bytes) salida += ALFABETO[b % ALFABETO.length];
  return salida;
}

export interface EstadoApple {
  /** Si no, el botón no se enseña. */
  disponible: boolean;
  /** Mientras se abre Apple y vuelve. */
  entrando: boolean;
  /** Deja la sesión de Firebase iniciada, o `null` si se cerró sin entrar. */
  entrar: () => Promise<UserCredential | null>;
}

/** En web lo hace Firebase solo, con su propia ventana. */
function useAppleWeb(): EstadoApple {
  const [entrando, setEntrando] = useState(false);

  const entrar = async (): Promise<UserCredential | null> => {
    setEntrando(true);
    try {
      const proveedor = new OAuthProvider('apple.com');
      proveedor.addScope('email');
      proveedor.addScope('name');
      return await signInWithPopup(auth, proveedor);
    } catch (e) {
      const codigo = (e as { code?: string })?.code ?? '';
      // Cerrar la ventana no es un error que haya que enseñar.
      if (/popup-closed-by-user|cancelled-popup-request|user-cancelled/.test(codigo)) return null;
      throw e;
    } finally {
      setEntrando(false);
    }
  };

  return { disponible: true, entrando, entrar };
}

/** En iOS, la hoja del sistema. */
function useAppleNativo(): EstadoApple {
  const [disponible, setDisponible] = useState(false);
  const [entrando, setEntrando] = useState(false);

  // No todos los iPhone la tienen: hace falta iOS 13 y sesión de iCloud. Se
  // pregunta antes de dibujar el botón.
  useEffect(() => {
    let vivo = true;
    AppleAuthentication.isAvailableAsync()
      .then((hay) => vivo && setDisponible(hay))
      .catch(() => vivo && setDisponible(false));
    return () => {
      vivo = false;
    };
  }, []);

  const entrar = async (): Promise<UserCredential | null> => {
    setEntrando(true);
    try {
      const bruto = nuevoNonce();
      const cifrado = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        bruto
      );
      const credencial = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: cifrado,
      });
      if (!credencial.identityToken) {
        throw new Error('Apple no ha devuelto la identidad de la cuenta.');
      }
      const proveedor = new OAuthProvider('apple.com');
      return await signInWithCredential(
        auth,
        proveedor.credential({ idToken: credencial.identityToken, rawNonce: bruto })
      );
    } catch (e) {
      // Cancelar no es fallar: se cierra la hoja y ya está.
      if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return null;
      throw e;
    } finally {
      setEntrando(false);
    }
  };

  return { disponible, entrando, entrar };
}

/** Fuera de iOS y de la web no se ofrece, y sobre todo no se rompe. */
function useSinApple(): EstadoApple {
  return { disponible: false, entrando: false, entrar: async () => null };
}

/**
 * Cuál de los tres se usa se decide UNA vez, al cargar el módulo: la
 * plataforma no cambia mientras la app está abierta, así que la identidad del
 * hook es estable y las reglas de los hooks se cumplen.
 */
export const useAppleSignIn: () => EstadoApple =
  Platform.OS === 'web' ? useAppleWeb : Platform.OS === 'ios' ? useAppleNativo : useSinApple;

/**
 * El nombre que Apple manda UNA sola vez.
 *
 * Apple da el nombre en el primer inicio de sesión y nunca más: si no se
 * guarda ahí, esa cuenta se queda sin nombre para siempre. Y con "Ocultar mi
 * correo" tampoco llega uno de verdad, así que el nombre es lo único con lo
 * que se puede llamar a esa persona por su nombre.
 */
export function nombreDeApple(
  full: { givenName?: string | null; familyName?: string | null } | null | undefined
): string {
  return [full?.givenName, full?.familyName].filter(Boolean).join(' ').trim();
}
