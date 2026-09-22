import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import {
  OAuthProvider,
  signInWithCredential,
  signInWithPopup,
  updateProfile,
  type UserCredential,
} from 'firebase/auth';
import { auth } from './firebase';
import { nombreDeApple, recordarNombreDelProveedor } from './nombreDelProveedor';

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
        // Con código, para que salga detrás del mensaje. Sin él, este fallo
        // —el de Apple— y el de Firebase rechazando el token se leen igual en
        // una captura, y son dos arreglos distintos en dos sitios distintos.
        throw Object.assign(new Error('Apple no ha devuelto la identidad de la cuenta.'), {
          code: 'apple-sin-identidad',
        });
      }
      /*
       * EL NOMBRE SE GUARDA AQUÍ, ANTES DE LLAMAR A FIREBASE.
       *
       * En cuanto `signInWithCredential` resuelve, Firebase avisa de que hay
       * sesión, el contexto reparte el usuario y la app salta a la pantalla de
       * completar cuenta — todo eso ANTES de que termine el `updateProfile` de
       * unas líneas más abajo. La pantalla leía un nombre vacío y enseñaba el
       * campo, que es justo lo que Apple rechaza por la norma 4.
       *
       * Puesto antes, cuando la pantalla mira, el nombre ya está.
       */
      const nombre = nombreDeApple(credencial.fullName);
      recordarNombreDelProveedor(nombre);

      const proveedor = new OAuthProvider('apple.com');
      const sesion = await signInWithCredential(
        auth,
        proveedor.credential({ idToken: credencial.identityToken, rawNonce: bruto })
      );

      /*
       * EL NOMBRE, GUARDADO AQUÍ Y AHORA. ES LA ÚNICA OPORTUNIDAD.
       *
       * Apple manda el nombre en el PRIMER inicio de sesión y nunca más. Y no
       * viaja dentro del identity token, así que Firebase no lo ve: la cuenta
       * nace sin `displayName` por muchas veces que se vuelva a entrar.
       *
       * `nombreDeApple` existía desde el principio y no la llamaba nadie. El
       * resultado: se tiraba el nombre que Apple acababa de dar y después la
       * app se lo pedía por escrito en la pantalla de completar cuenta. Eso es
       * exactamente lo que Apple rechazó por la norma 4 el 17 de septiembre —
       * "users are required to provide their name ... even though that
       * information is already provided by the Authentication Services
       * framework"—, y con razón: pedir dos veces algo que ya te han dado es
       * hacerle trabajo al usuario para nada.
       *
       * Solo si no hay ya uno: en las entradas siguientes Apple no manda
       * nombre, y escribir vacío encima borraría el que se guardó la primera.
       *
       * Si falla, se sigue. Quedarse sin nombre es un incordio; quedarse sin
       * entrar por no poder escribirlo, no.
       *
       * Y OJO CON LA OTRA MITAD DEL PROBLEMA: Apple manda el nombre en la
       * PRIMERA autorización y nunca más. Quien vuelve a entrar —o quien borró
       * su cuenta en la app y vuelve— llega sin nombre por mucho que el
       * sistema se lo acabe de enseñar en su ventana, y no hay forma de
       * pedírselo otra vez a Apple. Por eso la pantalla de completar cuenta NO
       * PUEDE exigirlo: ver lib/nombreDelProveedor.ts.
       */
      if (nombre && !sesion.user.displayName) {
        await updateProfile(sesion.user, { displayName: nombre }).catch(() => {});
      }
      return sesion;
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

/*
 * El nombre vive en lib/nombreDelProveedor.ts, sin imports.
 *
 * Este fichero arrastra React Native, así que no se puede ejecutar desde Node
 * pelado — y esa función es justo la que costó el rechazo de la norma 4 por
 * estar escrita y no llamarse desde ningún sitio. Se reexporta para no tocar
 * ningún import de los que ya había.
 */
export { nombreDeApple } from './nombreDelProveedor';
