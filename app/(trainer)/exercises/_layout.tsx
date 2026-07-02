import React from 'react';
import { Stack } from 'expo-router';
import { colors } from '../../../lib/theme';

export default function ExercisesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Ejercicios' }} />
      <Stack.Screen name="[id]" options={{ title: 'Ejercicio' }} />
    </Stack>
  );
}
