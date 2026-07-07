import React, { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../../components/Avatar';
import { Card } from '../../../components/Card';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorState } from '../../../components/ErrorState';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { TextField } from '../../../components/TextField';
import { useAuth } from '../../../lib/auth-context';
import { getClientsForTrainer } from '../../../lib/firestore/users';
import { colors, fonts, radius, spacing, typography } from '../../../lib/theme';
import { CLIENT_STATUS_LABEL, type UserProfile } from '../../../lib/types';

export default function ClientsScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      const data = await getClientsForTrainer(profile.uid);
      setClients(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) return <LoadingScreen />;

  if (error) {
    return (
      <ScreenContainer>
        <Text style={styles.title}>Tus clientes</Text>
        <ErrorState
          title="No se pudo cargar la lista"
          subtitle={error}
          onRetry={() => {
            setLoading(true);
            load();
          }}
        />
      </ScreenContainer>
    );
  }

  const filtered = clients.filter((c) =>
    (c.name ?? '').toLowerCase().includes(search.toLowerCase().trim())
  );

  return (
    <ScreenContainer refreshing={refreshing} onRefresh={onRefresh}>
      <Text style={styles.title}>Tus clientes</Text>
      <Text style={styles.subtitle}>{clients.length} cliente(s) activos</Text>

      {clients.length > 0 ? (
        <TextField
          placeholder="Buscar cliente..."
          value={search}
          onChangeText={setSearch}
          style={styles.search}
        />
      ) : null}

      {clients.length === 0 ? (
        <Card style={styles.inviteCard}>
          <Text style={styles.inviteTitle}>Aún no tienes clientes</Text>
          <Text style={styles.inviteText}>
            Comparte tu código de invitación desde la pestaña de Perfil para que tus clientes
            se registren y aparezcan aquí automáticamente.
          </Text>
        </Card>
      ) : filtered.length === 0 ? (
        <EmptyState title="Sin resultados" subtitle="Prueba con otro nombre." />
      ) : (
        filtered.map((client) => (
          <Pressable
            key={client.uid}
            onPress={() => router.push(`/(trainer)/clients/${client.uid}`)}
          >
            <Card style={styles.clientCard}>
              <Avatar name={client.name} photoURL={client.photoURL} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.clientName}>{client.name}</Text>
                <Text style={styles.clientGoal}>{client.goal || 'Sin objetivo definido'}</Text>
              </View>
              {client.status && client.status !== 'active' ? (
                <View style={styles.statusDot}>
                  <Text style={styles.statusDotText}>{CLIENT_STATUS_LABEL[client.status]}</Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
            </Card>
          </Pressable>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  search: { marginBottom: spacing.sm },
  inviteCard: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  inviteTitle: { ...typography.h3, color: colors.text },
  inviteText: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  clientName: { ...typography.h3, color: colors.text },
  clientGoal: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  statusDot: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.dangerMuted,
  },
  statusDotText: { ...typography.small, color: colors.warning, fontFamily: fonts.semiBold, fontSize: 11 },
});
