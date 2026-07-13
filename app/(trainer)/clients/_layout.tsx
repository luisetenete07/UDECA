import React from 'react';
import { Stack } from 'expo-router';
import { stackScreenOptions } from '../../../lib/navTheme';

export default function ClientsLayout() {
  return (
    <Stack
      screenOptions={stackScreenOptions}
    >
      <Stack.Screen name="index" options={{ title: 'Clientes' }} />
      <Stack.Screen name="meal-books" options={{ title: 'Libretas de comida' }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Cliente' }} />
      <Stack.Screen name="[id]/routine" options={{ title: 'Rutina' }} />
      <Stack.Screen name="[id]/nutrition" options={{ title: 'Nutrición' }} />
      <Stack.Screen name="[id]/session" options={{ title: 'Sesión' }} />
    </Stack>
  );
}
