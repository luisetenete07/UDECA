import React, { useEffect } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { TabIcon } from '../../components/TabIcon';
import { LoadingScreen } from '../../components/LoadingScreen';
import { VerifyEmailScreen } from '../../components/VerifyEmailScreen';
import { useAuth } from '../../lib/auth-context';
import { useTabScreenOptions } from '../../lib/navTheme';
import { useT } from '../../lib/idioma';
import { fijarCoach } from '../../lib/coachUnico';

export default function TrainerLayout() {
  const { loading, firebaseUser, profile, emailVerified } = useAuth();
  // Antes de los `return` de abajo: un hook no puede quedarse sin llamar.
  const tabOptions = useTabScreenOptions();
  const t = useT();

  // La cuenta de Luis se apunta como EL coach, para que los alumnos nuevos le
  // manden la solicitud sin código (lib/coachUnico.ts). Solo escribe si falta.
  useEffect(() => {
    void fijarCoach(profile);
  }, [profile]);

  if (loading) return <LoadingScreen />;
  if (!firebaseUser || !profile) return <Redirect href="/(auth)/login" />;
  if (profile.role !== 'trainer') return <Redirect href="/(client)/dashboard" />;
  // Correo sin verificar (cuentas que lo requieren): bloquea hasta verificar.
  if (profile.emailVerificationRequired && !emailVerified) return <VerifyEmailScreen />;
  // Sin muro de pago ni de alta: la app es de un solo entrenador y no cobra
  // nada a nadie. Esos muros eran de cuando cada coach pagaba su plan.

  return (
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
        name="clients"
        options={{
          title: t('Clientes'),
          tabBarIcon: (props) => <TabIcon {...props} outline="people-outline" filled="people" />,
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          title: t('Ejercicios'),
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
      {/* Calendario: ya no es una pestaña fija (menos saturación). Se abre desde
          la tarjeta "Calendario y tareas" del Inicio; la ruta sigue disponible. */}
      <Tabs.Screen
        name="agenda"
        options={{
          href: null,
          title: 'Calendario',
          tabBarIcon: (props) => (
            <TabIcon {...props} outline="calendar-outline" filled="calendar" />
          ),
        }}
      />
      {/* Llamadas 1:1: horarios y planes. Se abre desde el Calendario. */}
      <Tabs.Screen
        name="llamadas"
        options={{
          href: null,
          title: 'Llamadas',
          tabBarIcon: (props) => <TabIcon {...props} outline="call-outline" filled="call" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('Perfil'),
          tabBarIcon: (props) => (
            <TabIcon {...props} outline="person-circle-outline" filled="person-circle" />
          ),
        }}
      />
    </Tabs>
  );
}
