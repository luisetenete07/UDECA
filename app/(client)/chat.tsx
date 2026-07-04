import React from 'react';
import { View } from 'react-native';
import { ChatThread } from '../../components/ChatThread';
import { EmptyState } from '../../components/EmptyState';
import { useAuth } from '../../lib/auth-context';
import { colors } from '../../lib/theme';

export default function ClientChatScreen() {
  const { profile } = useAuth();

  if (!profile?.trainerId) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <EmptyState
          title="Sin entrenador vinculado"
          subtitle="Vincúlate a tu entrenador con un código de invitación para poder chatear."
        />
      </View>
    );
  }

  return (
    <ChatThread
      trainerId={profile.trainerId}
      clientId={profile.uid}
      currentUserId={profile.uid}
      title="Chat con tu entrenador"
    />
  );
}
