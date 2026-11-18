import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  signInWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import { pedirEntrada } from './coachUnico';
import { registerForPushNotificationsAsync } from './notifications';
import { forgetAccount, proveedorDe, rememberAccount } from './rememberedAccounts';
import { clearCache } from './screenCache';
import { MARCA } from './marca';
import { olvidarNombreDelProveedor } from './nombreDelProveedor';
import { aplicarIdiomaDelPerfil } from './idioma';
import type { UserProfile } from './types';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isFirebaseConfigured: boolean;
  /** Si el correo del usuario actual está verificado (Firebase Auth). */
  emailVerified: boolean;
  /** El nombre de la app, tal y como se lee en las cabeceras. */
  marca: string;
  signIn: (email: string, password: string) => Promise<void>;
  /**
   * Crea el perfil de quien ya ha entrado con Google o con Apple pero todavía
   * no tiene uno.
   *
   * Siempre es un ALUMNO: Maestría en Calistenia tiene un solo entrenador, y su
   * cuenta ya existe. Crear la cuenta manda además la solicitud de entrada al
   * coach (ver lib/coachUnico.ts); hasta que la acepte, se ve la pantalla de
   * espera.
   */
  completarPerfilDeGoogle: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  /**
   * Vuelve a comprobar la contraseña de quien ya ha entrado.
   *
   * Firebase exige un inicio de sesión reciente para borrar una cuenta, y con
   * razón: un móvil abierto encima de la mesa no debería bastar para que
   * alguien borre la vida deportiva de otro.
   */
  reauthenticate: (password: string) => Promise<void>;
  /** Relee el perfil de la cuenta y devuelve el recién leído (null si no hay). */
  refreshProfile: () => Promise<UserProfile | null>;
  /** Recarga el usuario de Auth para refrescar el estado de verificación. */
  reloadUser: () => Promise<boolean>;
  /** Reenvía el correo de verificación al usuario actual. */
  resendVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  /**
   * Lee el perfil de la cuenta y lo devuelve además de guardarlo en el estado.
   *
   * Lo devuelve porque quien acaba de pedir un refresco (el muro de alta, por
   * ejemplo) necesita saber YA si el dato cambió, y el estado de React no está
   * disponible hasta el siguiente render.
   */
  const loadProfile = async (uid: string): Promise<UserProfile | null> => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const p = snap.data() as UserProfile;
        setProfile(p);
        // El idioma que haya elegido, en cuanto se sabe quién es. Sin elegir,
        // se queda el del teléfono.
        aplicarIdiomaDelPerfil(p.language);
        // Recuerda esta cuenta en el dispositivo para el selector de acceso
        // (con nombre, rol y foto completos).
        rememberAccount({ email: p.email, name: p.name, role: p.role, photoURL: p.photoURL });
        return p;
      }
      setProfile(null);
    } catch {
      // Si la lectura del perfil falla (sin red), no rompemos el arranque: el
      // correo ya se recordó al detectar la sesión.
    }
    return null;
  };

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setEmailVerified(user?.emailVerified ?? false);
      if (user) {
        // Recuerda la cuenta en cuanto hay sesión (aunque el perfil tarde o
        // falle en cargar): así el selector de acceso nunca la pierde.
        if (user.email) {
          // Con QUÉ entró, para que la pantalla de acceso sepa a quién llamar
          // al tocar su cara: Google o Apple.
          rememberAccount({
            email: user.email,
            name: user.displayName || undefined,
            provider: proveedorDe(user.providerData[0]?.providerId),
          });
        }
        await loadProfile(user.uid);
        // No bloquea el arranque: si falla (sin proyecto EAS, web, etc.) se ignora.
        registerForPushNotificationsAsync(user.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  /**
   * Termina de crear la cuenta de quien entró con Google o con Apple.
   *
   * Nace como alumno y SIN entrenador: el vínculo lo pone el coach al
   * aceptarle. La solicitud sale en el mismo paso para que no tenga que hacer
   * nada más; si todavía no se sabe quién es el coach, la pantalla de espera
   * (LinkTrainerScreen) le deja mandarla con el código.
   */
  const completarPerfilDeGoogle = async (name: string) => {
    const user = auth.currentUser;
    if (!user) throw new Error('No hay ninguna sesión abierta.');
    const limpio = name.trim() || user.displayName || 'Sin nombre';
    // Firestore no admite `undefined`, y una cuenta de Google puede venir sin
    // foto. Va como campo que existe o que no existe, nunca como campo vacío.
    const foto = user.photoURL ? { photoURL: user.photoURL } : {};
    const nuevo: UserProfile = {
      uid: user.uid,
      role: 'client',
      name: limpio,
      email: user.email ?? '',
      createdAt: Date.now(),
      ...foto,
    };
    await setDoc(doc(db, 'users', user.uid), nuevo);
    // Si la solicitud no sale (sin red), la cuenta ya existe y la pantalla de
    // espera deja mandarla otra vez: no se pierde nada.
    await pedirEntrada(nuevo).catch(() => false);
    setProfile(nuevo);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setProfile(null);
    // Vacía la caché de pantallas para no mostrar datos de otra cuenta.
    clearCache();
    // Y el nombre que acabara de dar el proveedor: es de quien se va, y si se
    // queda, el siguiente en entrar con Apple sin nombre vería el del anterior
    // puesto en su pantalla de completar cuenta.
    olvidarNombreDelProveedor();
  };

  /**
   * Borra la cuenta: primero el perfil en Firestore y luego el usuario de Auth.
   * Si Firebase pide reautenticación reciente, se propaga el error para que la
   * pantalla pida volver a iniciar sesión.
   *
   * Los DATOS se borran antes, desde la pantalla de borrado
   * (lib/firestore/eraseAccount.ts): aquí solo quedan el perfil y el usuario.
   * El orden importa —primero los datos, que necesitan sesión— y por eso esto
   * es el último paso y no el único.
   */
  const deleteAccount = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid));
    } catch {
      // Si el borrado del perfil falla, seguimos con el de Auth igualmente.
    }
    await deleteUser(user);
    // El selector de acceso guarda las cuentas usadas en ESTE dispositivo. Si
    // no se quita, la pantalla de entrar sigue ofreciendo una cuenta que ya no
    // existe, y quien acaba de borrarse se encuentra su nombre ahí al volver.
    if (user.email) await forgetAccount(user.email).catch(() => {});
    setProfile(null);
    clearCache();
  };

  const reauthenticate = async (password: string) => {
    const user = auth.currentUser;
    if (!user?.email) throw new Error('No hay sesión activa');
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  };

  const refreshProfile = async (): Promise<UserProfile | null> => {
    if (!firebaseUser) return null;
    return loadProfile(firebaseUser.uid);
  };

  const reloadUser = async () => {
    const user = auth.currentUser;
    if (!user) return false;
    await user.reload();
    const fresh = auth.currentUser;
    setFirebaseUser(fresh);
    setEmailVerified(fresh?.emailVerified ?? false);
    return fresh?.emailVerified ?? false;
  };

  const resendVerification = async () => {
    if (auth.currentUser) await sendEmailVerification(auth.currentUser);
  };

  const marca = MARCA;

  const value = useMemo(
    () => ({
      firebaseUser,
      profile,
      loading,
      isFirebaseConfigured,
      emailVerified,
      marca,
      signIn,
      completarPerfilDeGoogle,
      signOut,
      deleteAccount,
      reauthenticate,
      refreshProfile,
      reloadUser,
      resendVerification,
    }),
    [firebaseUser, profile, loading, emailVerified, marca]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de un AuthProvider');
  return ctx;
}
