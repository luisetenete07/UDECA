import React from 'react';
import { Stack } from 'expo-router';
import { stackScreenOptions } from '../../../lib/navTheme';

export default function CoursesLayout() {
  return (
    <Stack
      screenOptions={stackScreenOptions}
    >
      <Stack.Screen name="index" options={{ title: 'Cursos' }} />
      <Stack.Screen name="[id]" options={{ title: 'Editar curso' }} />
    </Stack>
  );
}
