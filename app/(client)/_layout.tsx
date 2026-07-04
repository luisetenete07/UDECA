import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { LoadingScreen } from '../../components/LoadingScreen';
import { useAuth } from '../../lib/auth-context';
import { colors } from '../../lib/theme';

function TabIcon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function ClientLayout() {
  const { loading, firebaseUser, profile } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!firebaseUser || !profile) return <Redirect href="/(auth)/login" />;
  if (profile.role !== 'client') return <Redirect href="/(trainer)/dashboard" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Inicio', tabBarIcon: () => <TabIcon emoji="🏠" /> }}
      />
      <Tabs.Screen
        name="workout"
        options={{ title: 'Entreno', tabBarIcon: () => <TabIcon emoji="🏋️" /> }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{ title: 'Nutrición', tabBarIcon: () => <TabIcon emoji="🥗" /> }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: 'Progreso', tabBarIcon: () => <TabIcon emoji="📈" /> }}
      />
      <Tabs.Screen
        name="chat"
        options={{ title: 'Chat', tabBarIcon: () => <TabIcon emoji="💬" /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Perfil', tabBarIcon: () => <TabIcon emoji="⚙️" /> }}
      />
    </Tabs>
  );
}
