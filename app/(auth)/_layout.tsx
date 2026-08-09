import React from 'react';
import { Redirect, Stack, usePathname } from 'expo-router';
import { LoadingScreen } from '../../components/LoadingScreen';
import { useAuth } from '../../lib/auth-context';
import { colors } from '../../lib/theme';

export default function AuthLayout() {
  const { loading, firebaseUser, profile } = useAuth();
  const ruta = usePathname();

  if (loading) {
    return <LoadingScreen />;
  }

  if (firebaseUser && profile) {
    return <Redirect href="/" />;
  }

  /*
   * Sesión abierta y todavía sin perfil: es lo que deja Google la primera vez
   * —da una identidad, pero no dice si quien entra es alumno, atleta o
   * entrenador— y hay que preguntarlo antes de poder mandarle a ninguna parte.
   *
   * La comprobación de la ruta no sobra: sin ella, la propia pantalla de
   * completar se redirigiría a sí misma en cada render.
   */
  if (firebaseUser && !profile && !ruta.endsWith('/completar')) {
    return <Redirect href="/(auth)/completar" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
