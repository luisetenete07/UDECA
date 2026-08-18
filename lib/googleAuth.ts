import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  type UserCredential,
} from 'firebase/auth';
import { auth } from './firebase';

/**
 * Entrar con Google.
 *
 * Son DOS caminos distintos porque no hay uno solo que funcione en los dos
 * sitios:
 *
 *  - En web, Firebase abre la ventana de Google él mismo (`signInWithPopup`).
 *    No hace falta nada más: ni paquetes, ni identificadores, ni configurar
 *    rutas de vuelta.
 *  - En móvil no existe esa ventana. Hay que abrir el navegador del sistema,
 *    que Google devuelva un id_token y dárselo a Firebase. Eso es
 *    `expo-auth-session`, y necesita un identificador de cliente de Google POR
 *    PLATAFORMA, creados en Google Cloud (ver `IDS_DE_GOOGLE`).
 *
 * Los dos acaban en el mismo sitio: una sesión de Firebase. Lo que pase
 * después —si esa cuenta ya tenía perfil o hay que crearlo— no es cosa de este
 * fichero, es de `lib/auth-context`.
 */

// Cierra la ventana del navegador al volver a la app. Sin esto, en Android se
// queda una pestaña abierta por encima después de entrar.
//
// Envuelto porque se ejecuta al cargar el módulo, y lo que lanza ahí no lo
// recoge nadie: en el móvil, una app que se cierra sola sin decir por qué.
// Es una llamada a un módulo nativo, y esas dependen de que el enlazado haya
// salido bien. Si fallara, lo peor que pasa es que quede una pestaña del
// navegador abierta después de entrar.
try {
  WebBrowser.maybeCompleteAuthSession();
} catch {
  /* entrar importa más que cerrar una pestaña */
}

/**
 * Identificadores de cliente de Google, uno por plataforma.
 *
 * Se crean en Google Cloud → APIs y servicios → Credenciales, en el MISMO
 * proyecto que Firebase, y se pegan en el .env como variables EXPO_PUBLIC_.
 * Son públicos por diseño (van dentro de la app), así que no son un secreto:
 * lo que protege la cuenta es el dominio y el identificador de la app, que se
 * declaran junto al cliente.
 *
 * Sin ellos el botón no aparece en móvil, en vez de aparecer y fallar al
 * pulsarlo. Un botón que no hace nada es peor que un botón que no está.
 */
export const IDS_DE_GOOGLE = {
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
};

/**
 * ¿Se puede ofrecer el botón en esta plataforma?
 *
 * En web siempre: lo único que hace falta es tener Google activado en la
 * consola de Firebase, y eso no se puede comprobar desde aquí. En móvil, solo
 * si hay identificador para esa plataforma.
 */
export function hayGoogle(): boolean {
  if (Platform.OS === 'web') return true;
  if (Platform.OS === 'ios') return !!IDS_DE_GOOGLE.ios;
  if (Platform.OS === 'android') return !!IDS_DE_GOOGLE.android;
  return false;
}

export interface EstadoGoogle {
  /** Si no, el botón no se enseña. */
  disponible: boolean;
  /** Mientras se abre Google y vuelve. */
  entrando: boolean;
  /**
   * Abre Google y deja la sesión de Firebase iniciada.
   *
   * Con `pista` (un correo) se le dice a Google con qué cuenta va la cosa y se
   * salta el "elige una cuenta": es lo que hace que tocar tu cara en la
   * pantalla de entrar sea UN toque y no tres. Sin ella, Google pregunta.
   *
   * Devuelve la credencial, o `null` si la persona cerró la ventana sin
   * elegir cuenta —que no es un error y no debe enseñar ninguno—.
   */
  entrar: (pista?: string) => Promise<UserCredential | null>;
}

/**
 * En web lo hace Firebase solo, sin paquetes ni identificadores.
 */
function useGoogleWeb(): EstadoGoogle {
  const [entrando, setEntrando] = useState(false);

  const entrar = async (pista?: string): Promise<UserCredential | null> => {
    setEntrando(true);
    try {
      const provider = new GoogleAuthProvider();
      // Con pista, directo a esa cuenta: es alguien que ya ha entrado aquí y
      // ha tocado su propia cara. Sin pista, que pregunte: mucha gente tiene
      // la personal y la del trabajo, y entrar con la equivocada sin poder
      // elegir crea una cuenta duplicada que luego hay que deshacer a mano.
      provider.setCustomParameters(
        pista ? { login_hint: pista } : { prompt: 'select_account' }
      );
      return await signInWithPopup(auth, provider);
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

/**
 * En móvil hay que abrir el navegador del sistema y traerse el id_token.
 *
 * Este hook SOLO se usa si hay identificador para la plataforma: llamarlo sin
 * él no devuelve un estado vacío, LANZA, y se lleva por delante la pantalla de
 * entrar entera. Por eso la elección se hace abajo, al cargar el módulo.
 */
function useGoogleNativo(): EstadoGoogle {
  const [entrando, setEntrando] = useState(false);
  /**
   * La cuenta con la que se quiere entrar, si se ha tocado una guardada.
   *
   * Va en el estado y no en una variable suelta porque la PETICIÓN de Google
   * se construye a partir de esta configuración: al cambiar la pista, el hook
   * la reconstruye con `login_hint` dentro. Por eso `entrar` no abre Google en
   * el acto cuando hay pista nueva: espera a tener la petición buena (ver
   * abajo). Abrirla antes usaría la anterior, sin pista, y el atajo no
   * serviría de nada.
   */
  const [pista, setPista] = useState<string | undefined>(undefined);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: IDS_DE_GOOGLE.web,
    iosClientId: IDS_DE_GOOGLE.ios,
    androidClientId: IDS_DE_GOOGLE.android,
    extraParams: pista ? { login_hint: pista } : undefined,
  });

  // La respuesta de Google llega por aquí, y no como valor de retorno de
  // `promptAsync`, cuando el sistema reabre la app con el enlace de vuelta.
  const [pendiente, setPendiente] = useState<{
    ok: (c: UserCredential | null) => void;
    mal: (e: unknown) => void;
  } | null>(null);

  useEffect(() => {
    if (!pendiente || !response) return;
    setPendiente(null);
    if (response.type !== 'success') {
      // Cancelar no es fallar: se cierra y ya está.
      pendiente.ok(null);
      return;
    }
    const idToken = response.params?.id_token;
    if (!idToken) {
      pendiente.mal(new Error('Google no ha devuelto la identidad de la cuenta.'));
      return;
    }
    signInWithCredential(auth, GoogleAuthProvider.credential(idToken)).then(
      pendiente.ok,
      pendiente.mal
    );
  }, [response, pendiente]);

  /**
   * Abrir Google, cuando la petición ya lleva la pista puesta.
   *
   * `porAbrir` guarda el "quiero abrir" hasta que la petición se reconstruye
   * con el `login_hint` nuevo. Sin esta espera, el primer toque abriría Google
   * con la petición vieja —sin pista— y el atajo no ahorraría nada justo la
   * primera vez, que es cuando importa.
   */
  const [porAbrir, setPorAbrir] = useState<((e?: unknown) => void) | null>(null);
  useEffect(() => {
    if (!porAbrir || !request) return;
    /**
     * Y que la petición sea la de ESTA pista, no la de la vez anterior.
     *
     * Aquí estaba el fallo de "usar otra cuenta": bastaba con que hubiera
     * `request` para abrir Google, y justo después de tocar una cuenta
     * guardada el `request` que hay es el suyo, con su `login_hint` dentro.
     * Resultado: pedías entrar con OTRA cuenta y Google te llevaba
     * directamente a la de antes, sin preguntar. Parecía que el botón no
     * hacía nada.
     *
     * El hook reconstruye la petición cuando cambia `extraParams`, así que
     * basta con esperar: cuando esté lista, este efecto vuelve a entrar y
     * abre la buena.
     */
    if (request.extraParams?.login_hint !== pista) return;
    setPorAbrir(null);
    promptAsync().catch(porAbrir);
    // `promptAsync` cambia de identidad en cada render; añadirlo aquí abriría
    // Google dos veces.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porAbrir, request, pista]);

  const entrar = (nuevaPista?: string) =>
    new Promise<UserCredential | null>((ok, mal) => {
      setEntrando(true);
      const cerrar = (v: UserCredential | null) => {
        setEntrando(false);
        ok(v);
      };
      const fallar = (e: unknown) => {
        setEntrando(false);
        mal(e);
      };
      setPendiente({ ok: cerrar, mal: fallar });
      setPista(nuevaPista);
      setPorAbrir(() => fallar);
    });

  return { disponible: !!request, entrando, entrar };
}

/** Sin identificador configurado no hay botón, y sobre todo no hay error. */
function useSinGoogle(): EstadoGoogle {
  return { disponible: false, entrando: false, entrar: async () => null };
}

/**
 * Cuál de los tres se usa se decide UNA vez, al cargar el módulo.
 *
 * Ni la plataforma ni las variables de entorno cambian mientras la app está
 * abierta, así que la identidad del hook es estable y las reglas de los hooks
 * se cumplen. Hacerlo con un `if` dentro sería justo lo que no se puede.
 */
export const useGoogleSignIn: () => EstadoGoogle =
  Platform.OS === 'web' ? useGoogleWeb : hayGoogle() ? useGoogleNativo : useSinGoogle;
