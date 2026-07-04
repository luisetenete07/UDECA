import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TextField } from './TextField';
import { subscribeToMessages, sendMessage } from '../lib/firestore/chat';
import { colors, radius, spacing, typography } from '../lib/theme';
import type { ChatMessage } from '../lib/types';

interface ChatThreadProps {
  trainerId: string;
  clientId: string;
  currentUserId: string;
  title?: string;
}

export function ChatThread({ trainerId, clientId, currentUserId, title }: ChatThreadProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!clientId) return;
    const unsubscribe = subscribeToMessages(clientId, setMessages);
    return unsubscribe;
  }, [clientId]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    setText('');
    try {
      await sendMessage({ trainerId, clientId, senderId: currentUserId, text: trimmed });
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <SafeAreaView style={styles.safe} edges={['top']}>
        {title ? <Text style={styles.header}>{title}</Text> : null}
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              Todavía no hay mensajes. Escribe el primero para empezar la conversación.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => (
              <MessageBubble message={item} isMine={item.senderId === currentUserId} />
            )}
          />
        )}

        <View style={styles.inputRow}>
          <TextField
            value={text}
            onChangeText={setText}
            placeholder="Escribe un mensaje..."
            style={styles.input}
            multiline
          />
          <Pressable
            onPress={handleSend}
            disabled={sending || !text.trim()}
            style={[styles.sendButton, (sending || !text.trim()) && styles.sendButtonDisabled]}
          >
            <Ionicons name="send" size={18} color={colors.text} />
          </Pressable>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message, isMine }: { message: ChatMessage; isMine: boolean }) {
  return (
    <View style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{message.text}</Text>
        <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
          {new Date(message.createdAt).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    ...typography.h3,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyText: { ...typography.small, color: colors.textFaint, textAlign: 'center' },
  listContent: { padding: spacing.md, gap: spacing.xs },
  bubbleRow: { flexDirection: 'row', marginBottom: spacing.xs },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 2 },
  bubbleTheirs: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 2,
  },
  bubbleText: { ...typography.body, color: colors.text },
  bubbleTextMine: { color: colors.text },
  bubbleTime: { ...typography.small, color: colors.textFaint, marginTop: 2, fontSize: 10 },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, marginBottom: 0, maxHeight: 100 },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.4 },
});
