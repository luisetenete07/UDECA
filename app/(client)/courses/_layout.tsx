import React from 'react';
import { Stack } from 'expo-router';
import { colors } from '../../../lib/theme';

export default function ClientCoursesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Cursos' }} />
      <Stack.Screen name="[id]" options={{ title: 'Curso' }} />
    </Stack>
  );
}
