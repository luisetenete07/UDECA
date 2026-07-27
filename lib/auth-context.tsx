import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  deleteUser,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import { getTrainerIdForInviteCode, registerTrainerInviteCode } from './firestore/users';
import { sendJoinRequest } from './firestore/joinRequests';
import { registerForPushNotificationsAsync } from './notifications';
import { rememberAccount } from './rememberedAccounts';
import { clearCache } from './screenCache';
import { trialUntil } from './subscription';
import type { UserProfile, UserRole } from './types';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isFirebaseConfigured: boolean;
  /** Si el correo del usuario actual está verificado (Firebase Auth). */
  emailVerified: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  registerTrainer: (name: string, email: string, password: string) => Promise<void>;
  registerClient: (
    name: string,
    email: string,
    password: string,
    inviteCode: string
  ) => Promise<void>;
  registerAthlete: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
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

  const loadProfile = async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const p = snap.data() as UserProfile;
        setProfile(p);
        // Recuerda esta cuenta en el dispositivo para el selector de acceso
        // (con nombre, rol y foto completos).
        rememberAccount({ email: p.email, name: p.name, role: p.role, photoURL: p.photoURL });
      } else {
        setProfile(null);
      }
    } catch {
      // Si la lectura del perfil falla (sin red), no rompemos el arranque: el
      // correo ya se recordó al detectar la sesión.
    }
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
          rememberAccount({ email: user.email, name: user.displayName || undefined });
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
      // El plan de entrenador no tiene prueba: la cuenta nace pendiente de
      // activación (0 = caducada) y se abre al contratar la cuota anual.
      subscriptionUntil: 0,
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
    const trainerId = await getTrainerIdForInviteCode(inviteCode.trim().toUpperCase());
    if (!trainerId) {
      throw new Error('El código de entrenador no es válido. Revísalo con tu entrenador.');
    }

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

  // Atleta individual: es su propio coach (trainerId = su uid), sin código.
  // Nace con la suscripción pendiente (0 = caducada); paga cuota mensual.
  const registerAthlete = async (name: string, email: string, password: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: name });
    const newProfile: UserProfile = {
      uid: credential.user.uid,
      role: 'athlete' as UserRole,
      name,
      email,
      createdAt: Date.now(),
      trainerId: credential.user.uid,
      emailVerificationRequired: true,
      // El atleta entra probando y decide después de haber usado la app.
      subscriptionUntil: trialUntil(),
      trialEndsAt: trialUntil(),
    };
    await setDoc(doc(db, 'users', credential.user.uid), newProfile);
    sendEmailVerification(credential.user).catch(() => {});
    setProfile(newProfile);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setProfile(null);
    // Vacía la caché de pantallas para no mostrar datos de otra cuenta.
    clearCache();
  };

  // Borra la cuenta: primero el perfil en Firestore y luego el usuario de
  // Auth. Si Firebase pide reautenticación reciente, se propaga el error
  // para que la pantalla pida volver a iniciar sesión.
  const deleteAccount = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid));
    } catch {
      // Si el borrado del perfil falla, seguimos con el de Auth igualmente.
    }
    await deleteUser(user);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (firebaseUser) {
      await loadProfile(firebaseUser.uid);
    }
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

  const value = useMemo(
    () => ({
      firebaseUser,
      profile,
      loading,
      isFirebaseConfigured,
      emailVerified,
      signIn,
      registerTrainer,
      registerClient,
      registerAthlete,
      signOut,
      deleteAccount,
      refreshProfile,
      reloadUser,
      resendVerification,
    }),
    [firebaseUser, profile, loading, emailVerified]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de un AuthProvider');
  return ctx;
}
