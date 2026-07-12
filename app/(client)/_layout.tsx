import React, { useEffect, useState } from 'react';
import { Redirect, Tabs } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TabIcon } from '../../components/TabIcon';
import { LinkTrainerScreen } from '../../components/LinkTrainerScreen';
import { LoadingScreen } from '../../components/LoadingScreen';
import { Onboarding } from '../../components/Onboarding';
import { VerifyEmailScreen } from '../../components/VerifyEmailScreen';
import { useAuth } from '../../lib/auth-context';
import { tabScreenOptions } from '../../lib/navTheme';

const onboardingKey = (uid: string) => `udeca-onboarding-${uid}`;

export default function ClientLayout() {
  const { loading, firebaseUser, profile, emailVerified } = useAuth();
  // null = comprobando; true = ya visto; false = mostrar bienvenida.
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

  useEffect(() => {
    if (!profile) return;
    AsyncStorage.getItem(onboardingKey(profile.uid))
      .then((v) => setOnboardingSeen(v === '1'))
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
        onDone={() => {
          setOnboardingSeen(true);
          AsyncStorage.setItem(onboardingKey(profile.uid), '1').catch(() => {});
        }}
      />
    );
  }

  return (
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
  );
}
