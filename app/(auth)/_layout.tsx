import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { LoadingScreen } from '../../components/LoadingScreen';
import { useAuth } from '../../lib/auth-context';
import { colors } from '../../lib/theme';

export default function AuthLayout() {
  const { loading, firebaseUser, profile } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (firebaseUser && profile) {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
