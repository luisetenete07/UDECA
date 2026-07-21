import React from 'react';
import { Stack } from 'expo-router';
import { stackScreenOptions } from '../../../lib/navTheme';

export default function ClientCoursesLayout() {
  return (
    <Stack
      screenOptions={stackScreenOptions}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Curso' }} />
    </Stack>
  );
}
