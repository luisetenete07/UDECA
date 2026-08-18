import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
// @ts-expect-error -- getReactNativePersistence exists at runtime but is missing from the firebase/auth types.
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

// Sin credenciales reales evitamos inicializar el SDK: Firebase valida el
// formato de apiKey de forma síncrona y lanzaría una excepción que rompería
// el arranque de la app (y el prerenderizado estático de la build web).
let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

if (isFirebaseConfigured) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);

  if (Platform.OS === 'web') {
    authInstance = getAuth(app);
  } else {
    /**
     * ARRANCAR AUNQUE ESTO FALLE.
     *
     * Estas tres líneas son de las primeras que ejecuta la app, antes de que
     * se pinte nada. Y son frágiles por debajo: `getReactNativePersistence`
     * NO existe en los tipos de firebase/auth —de ahí el @ts-expect-error de
     * arriba—, solo en la variante para React Native del paquete. Si el
     * empaquetador resuelve otra variante, esa función llega `undefined`,
     * llamarla lanza, y como esto pasa al cargar el módulo, no hay ningún
     * `try` por encima: el proceso se muere. En el móvil eso no es un error
     * en pantalla, es una app que se cierra sola al abrirla y no dice por qué.
     *
     * Sin la persistencia nativa la sesión no sobrevive a cerrar la app —hay
     * que volver a entrar—, que es un incordio. Pero un incordio es
     * infinitamente mejor que una app que no abre, así que si falla se sigue
     * con lo que haya.
     */
    try {
      const persistencia =
        typeof getReactNativePersistence === 'function'
          ? getReactNativePersistence(AsyncStorage)
          : undefined;
      authInstance = persistencia
        ? initializeAuth(app, { persistence: persistencia })
        : initializeAuth(app);
    } catch {
      // `initializeAuth` también lanza si ya se llamó antes (recarga en
      // caliente). En los dos casos, `getAuth` devuelve la instancia buena.
      authInstance = getAuth(app);
    }
  }

  dbInstance = getFirestore(app);

  // Modo emulador: apunta el SDK a un Firebase local en vez de al de verdad.
  // Solo se activa con EXPO_PUBLIC_FIREBASE_EMULATOR=1 al compilar, algo que
  // NUNCA ocurre en los builds de tienda ni en el despliegue web. Sirve para
  // poder abrir la app con datos de prueba y revisarla pantalla por pantalla
  // sin tocar la base de datos real ni depender de capturas de terceros.
  if (process.env.EXPO_PUBLIC_FIREBASE_EMULATOR === '1') {
    const host = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST || '127.0.0.1';
    connectAuthEmulator(authInstance, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(dbInstance, host, 8080);
  }
}

// Estos valores solo se usan cuando isFirebaseConfigured es true (comprobado
// antes de cualquier llamada a auth/db en el resto de la app), por lo que el
// cast es seguro.
export const auth = authInstance as Auth;
export const db = dbInstance as Firestore;
export default app;
