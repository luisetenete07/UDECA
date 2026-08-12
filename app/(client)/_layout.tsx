import React, { useEffect, useRef, useState } from 'react';
import { Redirect, Tabs } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, View } from 'react-native';
import { markPresence } from '../../lib/presence';
import { TabIcon } from '../../components/TabIcon';
import { GlobalRestTimer } from '../../components/GlobalRestTimer';
import { LinkTrainerScreen } from '../../components/LinkTrainerScreen';
import { LoadingScreen } from '../../components/LoadingScreen';
import { Onboarding } from '../../components/Onboarding';
import { Paywall } from '../../components/Paywall';
import { EntryWall } from '../../components/EntryWall';
import { ClientLockScreen } from '../../components/ClientLockScreen';
import { VerifyEmailScreen } from '../../components/VerifyEmailScreen';
import { useAuth } from '../../lib/auth-context';
import { clientIsLocked, hasPlatformAccess, needsEntryPayment } from '../../lib/subscription';
import { markOnboardingComplete } from '../../lib/firestore/sync';
import { updateUserProfile } from '../../lib/firestore/users';
import { useTabScreenOptions } from '../../lib/navTheme';
import { useT } from '../../lib/idioma';

const onboardingKey = (uid: string) => `udeca-onboarding-${uid}`;

export default function ClientLayout() {
  const { loading, firebaseUser, profile, emailVerified, refreshProfile } = useAuth();
  // Antes de los `return` de abajo: un hook no puede quedarse sin llamar.
  const tabOptions = useTabScreenOptions();
  const t = useT();
  // null = comprobando; true = ya visto; false = mostrar bienvenida.
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);
  // Una vez terminado en esta sesión, no dejamos que un refresco del perfil lo
  // vuelva a evaluar (evita que el botón "Guardar y empezar" parezca no hacer nada).
  const doneRef = useRef(false);

  // Presencia "en línea" para el coach: latido al abrir y al volver a la app,
  // más un tic periódico mientras está abierta (limitado dentro de markPresence).
  useEffect(() => {
    if (!profile || profile.role !== 'client') return;
    markPresence(profile);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') markPresence(profile);
    });
    const tick = setInterval(() => markPresence(profile), 4 * 60 * 1000 + 500);
    return () => {
      sub.remove();
      clearInterval(tick);
    };
  }, [profile]);

  useEffect(() => {
    if (!profile || doneRef.current) return;
    // La cuenta manda: si ya se completó en cualquier dispositivo, no se repite.
    if (profile.onboardingCompleted) {
      setOnboardingSeen(true);
      return;
    }
    AsyncStorage.getItem(onboardingKey(profile.uid))
      .then((v) => {
        if (v === '1') {
          setOnboardingSeen(true);
          // Este dispositivo ya lo vio: propágalo a la cuenta para el resto.
          markOnboardingComplete(profile.uid).catch(() => {});
        } else {
          setOnboardingSeen(false);
        }
      })
      .catch(() => setOnboardingSeen(true));
  }, [profile]);

  if (loading) return <LoadingScreen />;
  if (!firebaseUser || !profile) return <Redirect href="/(auth)/login" />;
  // Aquí viven tanto alumnos (con coach) como atletas (autoentrenados).
  const isAthlete = profile.role === 'athlete';
  if (profile.role !== 'client' && !isAthlete) {
    return <Redirect href="/(trainer)/dashboard" />;
  }
  // Correo sin verificar (cuentas que lo requieren): bloquea hasta verificar.
  if (profile.emailVerificationRequired && !emailVerified) return <VerifyEmailScreen />;
  // Alta de 1 € del atleta: con ella arrancan sus 14 días. El alumno de un
  // coach no paga nada, así que `needsEntryPayment` ya lo descarta.
  if (needsEntryPayment(profile)) return <EntryWall />;
  // Atleta con la suscripción caducada: muro de pago (10 €/mes). Al alumno de
  // un coach la misma puerta le deja pasar siempre: no paga plataforma.
  if (!hasPlatformAccess(profile)) return <Paywall />;
  // Alumno con la cuota vencida más allá del margen: acceso en pausa hasta que
  // pague o su entrenador confirme el cobro. `clientIsLocked` ya descarta a
  // quien no tiene entrenador o no tiene cuota, así que no hay riesgo de
  // bloquear a alguien a quien nadie le cobra nada.
  if (!isAthlete && clientIsLocked(profile)) return <ClientLockScreen />;
  // Alumno sin entrenador: pantalla para enviar/esperar la solicitud. Los
  // atletas son su propio coach (trainerId propio), así que no la ven.
  if (!isAthlete && !profile.trainerId) return <LinkTrainerScreen />;
  // Bienvenida de primer uso (una vez por dispositivo).
  if (onboardingSeen === null) return <LoadingScreen />;
  if (!onboardingSeen) {
    return (
      <Onboarding
        name={profile.name}
        role={profile.role}
        onDone={(targets, goal, mainGoal) => {
          doneRef.current = true;
          setOnboardingSeen(true);
          AsyncStorage.setItem(onboardingKey(profile.uid), '1').catch(() => {});
          markOnboardingComplete(profile.uid).catch(() => {});
          // Guardamos lo que el alumno haya definido: sus macros (si los calculó)
          // y su objetivo principal (editable luego desde el perfil).
          const updates: Parameters<typeof updateUserProfile>[1] = {};
          if (targets) updates.nutritionTargets = { ...targets, goal, updatedAt: Date.now() };
          if (mainGoal) updates.goal = mainGoal;
          if (Object.keys(updates).length > 0) {
            updateUserProfile(profile.uid, updates)
              .then(() => refreshProfile())
              .catch(() => {});
          }
        }}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={tabOptions}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t('Inicio'),
          tabBarIcon: (props) => <TabIcon {...props} outline="home-outline" filled="home" />,
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: t('Entreno'),
          tabBarIcon: (props) => (
            <TabIcon {...props} outline="barbell-outline" filled="barbell" />
          ),
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          title: t('Cursos'),
          tabBarIcon: (props) => (
            <TabIcon {...props} outline="school-outline" filled="school" />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: t('Progreso'),
          tabBarIcon: (props) => (
            <TabIcon {...props} outline="trending-up-outline" filled="trending-up" />
          ),
        }}
      />
      {/* El atleta se autoentrena (sin grupo ni coach): no ve la sección Social. */}
      <Tabs.Screen
        name="social"
        options={{
          title: t('Social'),
          href: isAthlete ? null : undefined,
          tabBarIcon: (props) => <TabIcon {...props} outline="people-outline" filled="people" />,
        }}
      />
      {/* El perfil se abre tocando el avatar en Inicio; lo ocultamos de la
          barra para no saturarla con demasiadas pestañas. */}
      <Tabs.Screen name="profile" options={{ href: null }} />
      {/* Editor de plan del atleta (se abre desde Inicio, no es una pestaña). */}
      <Tabs.Screen name="my-plan" options={{ href: null }} />
      {/* Registrar un entreno de otro día (se abre desde Entreno y Progreso). */}
      <Tabs.Screen name="registrar" options={{ href: null }} />
      {/* Temporada del atleta: sus bloques y sus semanas (se abre desde Inicio). */}
      <Tabs.Screen name="planning" options={{ href: null }} />
    </Tabs>
    {/* Crono de descanso global: sigue corriendo y visible en cualquier pestaña. */}
    <GlobalRestTimer />
    </View>
  );
}
