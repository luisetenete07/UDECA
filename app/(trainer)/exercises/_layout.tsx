import { t } from '../../../lib/idioma';
import React from 'react';
import { Stack } from 'expo-router';
import { stackScreenOptions } from '../../../lib/navTheme';

export default function ExercisesLayout() {
  return (
    <Stack
      screenOptions={stackScreenOptions}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: t('Ejercicio') }} />
      <Stack.Screen name="template" options={{ title: t('Plantilla UDECA') }} />
    </Stack>
  );
}
