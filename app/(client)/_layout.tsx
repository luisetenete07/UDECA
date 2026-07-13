import React, { useEffect, useState } from 'react';
import { Redirect, Tabs } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View } from 'react-native';
import { TabIcon } from '../../components/TabIcon';
import { GlobalRestTimer } from '../../components/GlobalRestTimer';
import { LinkTrainerScreen } from '../../components/LinkTrainerScreen';
import { LoadingScreen } from '../../components/LoadingScreen';
import { Onboarding } from '../../components/Onboarding';
import { VerifyEmailScreen } from '../../components/VerifyEmailScreen';
import { useAuth } from '../../lib/auth-context';
import { markOnboardingComplete } from '../../lib/firestore/sync';
import { updateUserProfile } from '../../lib/firestore/users';
import { tabScreenOptions } from '../../lib/navTheme';

const onboardingKey = (uid: string) => `udeca-onboarding-${uid}`;

export default function ClientLayout() {
  const { loading, firebaseUser, profile, emailVerified, refreshProfile } = useAuth();
  // null = comprobando; true = ya visto; false = mostrar bienvenida.
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

  useEffect(() => {
    if (!profile) return;
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
  if (profile.role !== 'client') return <Redirect href="/(trainer)/dashboard" />;
  // Correo sin verificar (cuentas que lo requieren): bloquea hasta verificar.
  if (profile.emailVerificationRequired && !emailVerified) return <VerifyEmailScreen />;
  // Alumno sin entrenador: pantalla para enviar/esperar la solicitud.
  if (!profile.trainerId) return <LinkTrainerScreen />;
  // Bienvenida de primer uso (una vez por dispositivo).
  if (onboardingSeen === null) return <LoadingScreen />;
  if (!onboardingSeen) {
    return (
      <Onboarding
        name={profile.name}
        onDone={(targets, goal) => {
          setOnboardingSeen(true);
          AsyncStorage.setItem(onboardingKey(profile.uid), '1').catch(() => {});
          markOnboardingComplete(profile.uid).catch(() => {});
          // Si el alumno calculó sus macros, los dejamos guardados en su perfil
          // para que Nutrición los muestre aunque su coach no le asigne plan.
          if (targets) {
            updateUserProfile(profile.uid, {
              nutritionTargets: { ...targets, goal, updatedAt: Date.now() },
            })
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
      screenOptions={tabScreenOptions}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Inicio',
          tabBarIcon: (props) => <TabIcon {...props} outline="home-outline" filled="home" />,
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Entreno',
          tabBarIcon: (props) => (
            <TabIcon {...props} outline="barbell-outline" filled="barbell" />
          ),
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          title: 'Cursos',
          tabBarIcon: (props) => (
            <TabIcon {...props} outline="school-outline" filled="school" />
          ),
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Nutrición',
          tabBarIcon: (props) => (
            <TabIcon {...props} outline="nutrition-outline" filled="nutrition" />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progreso',
          tabBarIcon: (props) => (
            <TabIcon {...props} outline="trending-up-outline" filled="trending-up" />
          ),
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: 'Social',
          tabBarIcon: (props) => <TabIcon {...props} outline="people-outline" filled="people" />,
        }}
      />
      {/* El perfil se abre tocando el avatar en Inicio; lo ocultamos de la
          barra para no saturarla con demasiadas pestañas. */}
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
    {/* Crono de descanso global: sigue corriendo y visible en cualquier pestaña. */}
    <GlobalRestTimer />
    </View>
  );
}
