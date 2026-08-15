import React from 'react';
import { Stack } from 'expo-router';
import { t } from '../../../lib/idioma';
import { stackScreenOptions } from '../../../lib/navTheme';

/**
 * La biblioteca de ejercicios del ATLETA.
 *
 * Sin plantilla UDECA: esa es la precarga oficial que mantiene el CEO para los
 * entrenadores nuevos, y no pinta nada en la cuenta de alguien que se entrena
 * a sí mismo.
 */
export default function ExercisesLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: t('Ejercicio') }} />
    </Stack>
  );
}
