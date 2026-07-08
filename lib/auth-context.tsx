import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  deleteUser,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import { getTrainerIdForInviteCode, registerTrainerInviteCode } from './firestore/users';
import { registerForPushNotificationsAsync } from './notifications';
import type { UserProfile, UserRole } from './types';

interface AuthContextValue {
  firebaseUser: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isFirebaseConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  registerTrainer: (name: string, email: string, password: string) => Promise<void>;
  registerClient: (
    name: string,
    email: string,
    password: string,
    inviteCode: string
  ) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshProfile: () => Promise<void>;
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
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      setProfile(snap.data() as UserProfile);
    } else {
      setProfile(null);
    }
  };

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
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
    };
    await setDoc(doc(db, 'users', credential.user.uid), newProfile);
    await registerTrainerInviteCode(inviteCode, credential.user.uid);
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

    const newProfile: UserProfile = {
      uid: credential.user.uid,
      role: 'client' as UserRole,
      name,
      email,
      createdAt: Date.now(),
      trainerId,
    };
    await setDoc(doc(db, 'users', credential.user.uid), newProfile);
    setProfile(newProfile);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setProfile(null);
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

  const value = useMemo(
    () => ({
      firebaseUser,
      profile,
      loading,
      isFirebaseConfigured,
      signIn,
      registerTrainer,
      registerClient,
      signOut,
      deleteAccount,
      refreshProfile,
    }),
    [firebaseUser, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de un AuthProvider');
  return ctx;
}
