import React from 'react';
import { Stack } from 'expo-router';
import { stackScreenOptions } from '../../../lib/navTheme';

export default function MethodLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      {/* La pantalla índice usa su propio título grande, sin barra superior. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Metodología' }} />
    </Stack>
  );
}
