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

  /*
   * Y la vuelta: sin sesión, en "completar" no se pinta nada.
   *
   * Esa pantalla existe para terminar de crear UNA cuenta concreta, y tiene un
   * "Entrar con otra cuenta" que cierra la sesión. Sin esta línea, cerrarla no
   * llevaba a ninguna parte: la sesión se iba de verdad, pero la pantalla se
   * quedaba clavada con el mismo formulario delante. Lo único que cambiaba era
   * el subtítulo, que pasaba de decir el correo a decir "tu cuenta de Google"
   * —porque ya no había usuario del que sacarlo—, y eso no se lee como "has
   * salido", se lee como que el botón está roto.
   *
   * La condición mira SOLO la sesión: quedarse aquí sin ella no tiene ningún
   * uso, venga uno de donde venga.
   */
  if (!firebaseUser && ruta.endsWith('/completar')) {
    return <Redirect href="/(auth)/login" />;
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
