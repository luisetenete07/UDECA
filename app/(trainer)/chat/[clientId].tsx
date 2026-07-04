import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { ChatThread } from '../../../components/ChatThread';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { useAuth } from '../../../lib/auth-context';
import { getUserProfile } from '../../../lib/firestore/users';

export default function TrainerChatScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { profile } = useAuth();
  const navigation = useNavigation();
  const [clientName, setClientName] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    getUserProfile(clientId).then((client) => setClientName(client?.name ?? null));
  }, [clientId]);

  useEffect(() => {
    if (clientName) {
      navigation.setOptions({ title: clientName });
    }
  }, [clientName, navigation]);

  if (!profile || !clientId) return <LoadingScreen />;

  return <ChatThread trainerId={profile.uid} clientId={clientId} currentUserId={profile.uid} />;
}
