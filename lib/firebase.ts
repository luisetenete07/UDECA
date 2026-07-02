import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, type Auth } from 'firebase/auth';
// @ts-expect-error -- getReactNativePersistence exists at runtime but is missing from the firebase/auth types.
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
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
    authInstance = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }

  dbInstance = getFirestore(app);
}

// Estos valores solo se usan cuando isFirebaseConfigured es true (comprobado
// antes de cualquier llamada a auth/db en el resto de la app), por lo que el
// cast es seguro.
export const auth = authInstance as Auth;
export const db = dbInstance as Firestore;
export default app;
