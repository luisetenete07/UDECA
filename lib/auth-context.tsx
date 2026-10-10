import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  signInWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import { getInviteCodeInfo, registerTrainerInviteCode } from './firestore/users';
import { sendJoinRequest } from './firestore/joinRequests';
import { registerForPushNotificationsAsync } from './notifications';
import { forgetAccount, proveedorDe, rememberAccount } from './rememberedAccounts';
import { clearCache } from './screenCache';
import { suscripcionAlNacer } from './subscription';
import { MARCA_POR_DEFECTO, marcaDe } from './marcaPropia';
import { fijarMarcaActual } from './marcaActual';
import { puedeLlevarLogo } from './planBase';
import { olvidarNombreDelProveedor } from './nombreDelProveedor';
import { aplicarIdiomaDelPerfil } from './idioma';
import type { UserProfile, UserRole } from './types';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isFirebaseConfigured: boolean;
  /** Si el correo del usuario actual está verificado (Firebase Auth). */
  emailVerified: boolean;
  /**
   * La palabra que se lee donde pone "UDECA".
   *
   * Vive aquí y no en cada pantalla por un motivo concreto: para un ALUMNO no
   * es la suya, es la de su entrenador, y eso exige leer OTRO documento. Si lo
   * resolviera cada sitio que la pinta, serían tres lecturas de Firestore por
   * pantalla en vez de una por sesión.
   */
  marca: string;
  /**
   * El logo que sustituye al de UDECA: el suyo si es entrenador, el de su
   * entrenador si es alumno. `null` si no hay, o si su plan no lo incluye
   * (`puedeLlevarLogo`): entonces se ve el emblema de siempre.
   */
  logo: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  registerTrainer: (name: string, email: string, password: string) => Promise<void>;
  registerClient: (
    name: string,
    email: string,
    password: string,
    inviteCode: string
  ) => Promise<void>;
  /**
   * Crea el perfil de quien ya ha entrado con Google pero todavía no tiene uno.
   *
   * Google da una identidad, no un ROL: no sabe si quien entra es alumno,
   * atleta o entrenador, y eso decide la app entera. Así que entrar con Google
   * la primera vez deja la sesión iniciada y sin perfil, y esta pantalla lo
   * completa (ver app/(auth)/completar.tsx).
   */
  completarPerfilDeGoogle: (
    role: UserRole,
    name: string,
    inviteCode?: string
  ) => Promise<void>;
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

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  // Solo la marca del entrenador, no su perfil entero: es lo único que se
  // necesita de él aquí, y guardar el resto invitaría a usarlo para otras cosas
  // sin darse cuenta de que puede estar sin cargar.
  const [marcaDelCoach, setMarcaDelCoach] = useState<string | null>(null);
  // Su logo, ya filtrado por su plan: aquí solo llega si se puede enseñar.
  const [logoDelCoach, setLogoDelCoach] = useState<string | null>(null);

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
        /*
         * La marca de su entrenador, si es alumno.
         *
         * Las reglas ya dejan al alumno leer el perfil de SU coach, así que no
         * hace falta duplicar el dato en ningún sitio. Se pide sin `await` y
         * sin bloquear: mientras no llegue se lee UDECA, que es mejor que un
         * hueco parpadeando en la cabecera. Y si falla —sin red— tampoco pasa
         * nada: la app arranca igual.
         */
        if (p.role === 'client' && p.trainerId) {
          getDoc(doc(db, 'users', p.trainerId))
            .then((coach) => {
              const datos = coach.exists() ? (coach.data() as UserProfile) : null;
              setMarcaDelCoach(datos?.brandName ?? '');
              setLogoDelCoach(datos && puedeLlevarLogo(datos) ? (datos.brandLogo ?? null) : null);
            })
            .catch(() => {
              setMarcaDelCoach('');
              setLogoDelCoach(null);
            });
        } else {
          setMarcaDelCoach(null);
          setLogoDelCoach(null);
        }
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
   * Termina de crear la cuenta de quien entró con Google.
   *
   * Reutiliza a propósito las mismas piezas que el registro con correo —el
   * código de invitación, la solicitud al entrenador, la prueba gratuita—
   * porque son las mismas reglas: entrar por Google no puede saltarse el
   * permiso del entrenador ni regalar una prueba que no toca.
   */
  const completarPerfilDeGoogle = async (
    role: UserRole,
    name: string,
    inviteCode?: string
  ) => {
    const user = auth.currentUser;
    if (!user) throw new Error('No hay ninguna sesión abierta.');
    const limpio = name.trim() || user.displayName || 'Sin nombre';
    const email = user.email ?? '';
    // Firestore no admite `undefined`, y una cuenta de Google puede venir sin
    // foto. Va como campo que existe o que no existe, nunca como campo vacío.
    const foto = user.photoURL ? { photoURL: user.photoURL } : {};

    if (role === 'client') {
      const invite = await getInviteCodeInfo((inviteCode ?? '').trim().toUpperCase());
      if (!invite) {
        throw new Error('El código de entrenador no es válido. Revísalo con tu entrenador.');
      }
      if (invite.full) {
        throw new Error(
          'Tu entrenador ha alcanzado el límite de alumnos de su plan. Pídele que active su suscripción para poder entrar.'
        );
      }
      const nuevo: UserProfile = {
        uid: user.uid,
        role: 'client',
        name: limpio,
        email,
        createdAt: Date.now(),
        ...foto,
      };
      await setDoc(doc(db, 'users', user.uid), nuevo);
      await sendJoinRequest(invite.trainerId, nuevo);
      setProfile(nuevo);
      return;
    }

    // Si no es alumno, es entrenador.
    const codigo = generateInviteCode();
    const nuevo: UserProfile = {
      uid: user.uid,
      role: 'trainer',
      name: limpio,
      email,
      createdAt: Date.now(),
      inviteCode: codigo,
      ...foto,
      // Nace con sus 14 días de prueba, sin tarjeta (ver suscripcionAlNacer).
      ...suscripcionAlNacer(),
    };
    await setDoc(doc(db, 'users', user.uid), nuevo);
    await registerTrainerInviteCode(codigo, user.uid);
    setProfile(nuevo);
  };

  const registerTrainer = async (name: string, email: string, password: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: name });

    const inviteCode = generateInviteCode();
    const newProfile: UserProfile = {
      uid: credential.user.uid,
      role: 'trainer',
      name,
      email,
      createdAt: Date.now(),
      inviteCode,
      emailVerificationRequired: true,
      // Nace con sus 14 días de prueba, sin tarjeta (ver suscripcionAlNacer).
      ...suscripcionAlNacer(),
    };
    await setDoc(doc(db, 'users', credential.user.uid), newProfile);
    await registerTrainerInviteCode(inviteCode, credential.user.uid);
    // Envía el correo de verificación (no bloquea el registro si falla).
    sendEmailVerification(credential.user).catch(() => {});
    setProfile(newProfile);
  };

  const registerClient = async (
    name: string,
    email: string,
    password: string,
    inviteCode: string
  ) => {
    const invite = await getInviteCodeInfo(inviteCode.trim().toUpperCase());
    if (!invite) {
      throw new Error('El código de entrenador no es válido. Revísalo con tu entrenador.');
    }
    // Si el coach ha llenado su plan gratuito no se le puede añadir gente: le
    // dejaría por encima del límite y fuera de la app sin haber hecho nada.
    if (invite.full) {
      throw new Error(
        'Tu entrenador ha alcanzado el límite de alumnos de su plan. Pídele que active su suscripción para poder entrar.'
      );
    }
    const trainerId = invite.trainerId;

    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: name });

    // El alumno se crea SIN entrenador: envía una solicitud que el coach debe
    // aprobar manualmente. Hasta entonces verá la pantalla de "pendiente".
    const newProfile: UserProfile = {
      uid: credential.user.uid,
      role: 'client' as UserRole,
      name,
      email,
      createdAt: Date.now(),
      emailVerificationRequired: true,
    };
    await setDoc(doc(db, 'users', credential.user.uid), newProfile);
    await sendJoinRequest(trainerId, newProfile);
    sendEmailVerification(credential.user).catch(() => {});
    setProfile(newProfile);
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

  const marca = marcaDe(profile, marcaDelCoach === null ? null : { brandName: marcaDelCoach });
  const logo =
    profile?.role === 'client'
      ? logoDelCoach
      : puedeLlevarLogo(profile)
        ? (profile?.brandLogo ?? null)
        : null;
  // Las tarjetas que se comparten se pintan fuera de React: se les deja aquí.
  fijarMarcaActual({ marca: marca === MARCA_POR_DEFECTO ? '' : marca, logo });

  const value = useMemo(
    () => ({
      firebaseUser,
      profile,
      loading,
      isFirebaseConfigured,
      emailVerified,
      marca,
      logo,
      signIn,
      registerTrainer,
      registerClient,
      completarPerfilDeGoogle,
      signOut,
      deleteAccount,
      reauthenticate,
      refreshProfile,
      reloadUser,
      resendVerification,
    }),
    [firebaseUser, profile, loading, emailVerified, marca, logo]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de un AuthProvider');
  return ctx;
}
