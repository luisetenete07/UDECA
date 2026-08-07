import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { TabIcon } from '../../components/TabIcon';
import { LoadingScreen } from '../../components/LoadingScreen';
import { Paywall } from '../../components/Paywall';
import { EntryWall } from '../../components/EntryWall';
import { VerifyEmailScreen } from '../../components/VerifyEmailScreen';
import { useAuth } from '../../lib/auth-context';
import { useTabScreenOptions } from '../../lib/navTheme';
import { hasPlatformAccess, needsEntryPayment } from '../../lib/subscription';

export default function TrainerLayout() {
  const { loading, firebaseUser, profile, emailVerified } = useAuth();
  // Antes de los `return` de abajo: un hook no puede quedarse sin llamar.
  const tabOptions = useTabScreenOptions();

  if (loading) return <LoadingScreen />;
  if (!firebaseUser || !profile) return <Redirect href="/(auth)/login" />;
  if (profile.role !== 'trainer') return <Redirect href="/(client)/dashboard" />;
  // Correo sin verificar (cuentas que lo requieren): bloquea hasta verificar.
  if (profile.emailVerificationRequired && !emailVerified) return <VerifyEmailScreen />;
  // Alta de 1 €: va ANTES que el muro de suscripción porque es el primer
  // escalón (y el que identifica la tarjeta). Las cuentas anteriores al alta
  // no lo ven nunca.
  if (needsEntryPayment(profile)) return <EntryWall />;
  // SaaS: el coach entra gratis mientras su grupo no pase del límite; el muro
  // solo aparece cuando lo supera o cuando caduca una suscripción con más
  // alumnos de los que incluye su alta. Sus datos quedan intactos.
  // Es la misma puerta que enciende o apaga la insignia de fundador, a
  // propósito: una sola regla, un solo sitio (lib/planBase.ts).
  if (!hasPlatformAccess(profile)) return <Paywall />;

  return (
    <Tabs
      screenOptions={tabOptions}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Inicio',
          tabBarIcon: (props) => <TabIcon {...props} outline="home-outline" filled="home" />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clientes',
          tabBarIcon: (props) => <TabIcon {...props} outline="people-outline" filled="people" />,
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          title: 'Ejercicios',
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
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: (props) => (
            <TabIcon {...props} outline="person-circle-outline" filled="person-circle" />
          ),
        }}
      />
    </Tabs>
  );
}
