import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { TabIcon } from '../../components/TabIcon';
import { LoadingScreen } from '../../components/LoadingScreen';
import { useAuth } from '../../lib/auth-context';
import { colors } from '../../lib/theme';

export default function TrainerLayout() {
  const { loading, firebaseUser, profile } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!firebaseUser || !profile) return <Redirect href="/(auth)/login" />;
  if (profile.role !== 'trainer') return <Redirect href="/(client)/dashboard" />;

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
        options={{
          title: 'Inicio',
          tabBarIcon: (props) => <TabIcon {...props} outline="home-outline" filled="home" />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clientes',
          tabBarIcon: (props) => <TabIcon {...props} outline="people-outline" filled="people" />,
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          title: 'Ejercicios',
          tabBarIcon: (props) => (
            <TabIcon {...props} outline="barbell-outline" filled="barbell" />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: (props) => (
            <TabIcon {...props} outline="chatbubble-ellipses-outline" filled="chatbubble-ellipses" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: (props) => (
            <TabIcon {...props} outline="person-circle-outline" filled="person-circle" />
          ),
        }}
      />
    </Tabs>
  );
}
