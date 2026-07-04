import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../../components/Card';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { useAuth } from '../../../lib/auth-context';
import { getLastMessagesForTrainer } from '../../../lib/firestore/chat';
import { getClientsForTrainer } from '../../../lib/firestore/users';
import { colors, radius, spacing, typography } from '../../../lib/theme';
import type { ChatMessage, UserProfile } from '../../../lib/types';

export default function TrainerChatListScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [lastMessages, setLastMessages] = useState<Map<string, ChatMessage>>(new Map());
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      let cancelled = false;
      (async () => {
        const [clientData, lastMessageData] = await Promise.all([
          getClientsForTrainer(profile.uid),
          getLastMessagesForTrainer(profile.uid),
        ]);
        if (cancelled) return;
        setClients(clientData);
        setLastMessages(lastMessageData);
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [profile])
  );

  if (loading) return <LoadingScreen />;

  const sortedClients = [...clients].sort((a, b) => {
    const lastA = lastMessages.get(a.uid)?.createdAt ?? 0;
    const lastB = lastMessages.get(b.uid)?.createdAt ?? 0;
    return lastB - lastA;
  });

  return (
    <ScreenContainer>
      <Text style={styles.title}>Chats</Text>

      {clients.length === 0 ? (
        <EmptyState
          title="Sin clientes todavía"
          subtitle="Cuando tengas clientes vinculados, aquí verás tus conversaciones."
        />
      ) : (
        sortedClients.map((client) => {
          const last = lastMessages.get(client.uid);
          return (
            <Pressable key={client.uid} onPress={() => router.push(`/(trainer)/chat/${client.uid}`)}>
              <Card style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{client.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{client.name}</Text>
                  <Text style={styles.preview} numberOfLines={1}>
                    {last ? last.text : 'Sin mensajes todavía'}
                  </Text>
                </View>
              </Card>
            </Pressable>
          );
        })
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.h3, color: colors.white },
  name: { ...typography.h3, color: colors.text },
  preview: { ...typography.small, color: colors.textMuted, marginTop: 2 },
});
