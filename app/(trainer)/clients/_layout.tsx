import React from 'react';
import { Stack } from 'expo-router';
import { colors } from '../../../lib/theme';

export default function ClientsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Clientes' }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Cliente' }} />
      <Stack.Screen name="[id]/routine" options={{ title: 'Rutina' }} />
    </Stack>
  );
}
