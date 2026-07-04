import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { TabIcon } from '../../components/TabIcon';
import { LoadingScreen } from '../../components/LoadingScreen';
import { useAuth } from '../../lib/auth-context';
import { colors } from '../../lib/theme';

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
        options={{
          title: 'Inicio',
          tabBarIcon: (props) => <TabIcon {...props} outline="home-outline" filled="home" />,
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Entreno',
          tabBarIcon: (props) => (
            <TabIcon {...props} outline="barbell-outline" filled="barbell" />
          ),
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Nutrición',
          tabBarIcon: (props) => (
            <TabIcon {...props} outline="nutrition-outline" filled="nutrition" />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progreso',
          tabBarIcon: (props) => (
            <TabIcon {...props} outline="trending-up-outline" filled="trending-up" />
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
