import React from 'react';
import { Stack } from 'expo-router';
import { stackScreenOptions } from '../../../lib/navTheme';

export default function ClientsLayout() {
  return (
    <Stack
      screenOptions={stackScreenOptions}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="meal-books" options={{ title: 'Libretas de comida' }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Cliente' }} />
      {/* Estas dos ya llevan su título dentro, grande. Repetirlo en la barra es
          decir lo mismo dos veces y gastar una fila en ello: se queda solo la
          flecha de volver. */}
      <Stack.Screen name="[id]/overview" options={{ title: '' }} />
      <Stack.Screen name="[id]/routine" options={{ title: 'Rutina' }} />
      <Stack.Screen name="[id]/nutrition" options={{ title: 'Nutrición' }} />
      <Stack.Screen name="[id]/session" options={{ title: 'Sesión' }} />
      <Stack.Screen name="[id]/planning" options={{ title: '' }} />
      <Stack.Screen name="[id]/cycles/[cycleId]" options={{ title: 'Ciclo' }} />
    </Stack>
  );
}
