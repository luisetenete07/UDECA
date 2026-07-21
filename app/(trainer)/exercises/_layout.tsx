import React from 'react';
import { Stack } from 'expo-router';
import { stackScreenOptions } from '../../../lib/navTheme';

export default function ExercisesLayout() {
  return (
    <Stack
      screenOptions={stackScreenOptions}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Ejercicio' }} />
      <Stack.Screen name="template" options={{ title: 'Plantilla UDECA' }} />
    </Stack>
  );
}
