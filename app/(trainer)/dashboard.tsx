import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ScreenContainer } from '../../components/ScreenContainer';
import { useAuth } from '../../lib/auth-context';
import { sendMessage } from '../../lib/firestore/chat';
import { getClientsForTrainer } from '../../lib/firestore/users';
import { getWorkoutLogsForTrainer } from '../../lib/firestore/workoutLogs';
import { fonts, colors, spacing, typography } from '../../lib/theme';
import type { UserProfile, WorkoutLog } from '../../lib/types';

const INACTIVE_DAYS_THRESHOLD = 7;

export default function TrainerDashboard() {
  const { profile } = useAuth();
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [remindersSent, setRemindersSent] = useState<Set<string>>(new Set());
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      let cancelled = false;
      (async () => {
        const [clientData, logData] = await Promise.all([
          getClientsForTrainer(profile.uid),
          getWorkoutLogsForTrainer(profile.uid),
        ]);
        if (cancelled) return;
        setClients(clientData);
        setLogs(logData);
        setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [profile])
  );

  if (loading) return <LoadingScreen />;

  const now = Date.now();
  const lastLogByClient = new Map<string, number>();
  logs.forEach((log) => {
    const current = lastLogByClient.get(log.clientId);
    if (!current || log.date > current) lastLogByClient.set(log.clientId, log.date);
  });

  const inactiveClients = clients.filter((client) => {
    const last = lastLogByClient.get(client.uid);
    if (!last) return true;
    return (now - last) / (1000 * 60 * 60 * 24) > INACTIVE_DAYS_THRESHOLD;
  });

  const handleSendReminder = async (client: UserProfile) => {
    if (!profile) return;
    setSendingReminder(client.uid);
    try {
      await sendMessage({
        trainerId: profile.uid,
        clientId: client.uid,
        senderId: profile.uid,
        text: `Hola ${client.name.split(' ')[0]}, hace tiempo que no registras entrenamientos. ¿Todo bien? Aquí estoy para ayudarte a retomarlo.`,
      });
      setRemindersSent((prev) => new Set(prev).add(client.uid));
    } finally {
      setSendingReminder(null);
    }
  };

  return (
    <ScreenContainer>
      <Text style={styles.greeting}>Hola, {profile?.name?.split(' ')[0]}</Text>
      <Text style={styles.subtitle}>Resumen de tu negocio</Text>

      <View style={styles.statsRow}>
        <StatCard label="Clientes activos" value={String(clients.length)} />
        <StatCard label="Entrenos (total)" value={String(logs.length)} />
        <StatCard label="Inactivos" value={String(inactiveClients.length)} warn={inactiveClients.length > 0} />
      </View>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Últimos entrenamientos</Text>
        {logs.length === 0 ? (
          <EmptyState title="Todavía no hay entrenamientos registrados" />
        ) : (
          logs.slice(0, 5).map((log) => {
            const client = clients.find((c) => c.uid === log.clientId);
            return (
              <View key={log.id} style={styles.logRow}>
                <Text style={styles.logClient}>{client?.name ?? 'Cliente'}</Text>
                <Text style={styles.logDetail}>
                  {log.dayName} · {new Date(log.date).toLocaleDateString('es-ES')}
                </Text>
              </View>
            );
          })
        )}
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>
          Clientes inactivos (+{INACTIVE_DAYS_THRESHOLD} días sin entrenar)
        </Text>
        {inactiveClients.length === 0 ? (
          <Text style={styles.mutedText}>Todos tus clientes están al día.</Text>
        ) : (
          inactiveClients.map((client) => (
            <View key={client.uid} style={styles.inactiveRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.logClient}>{client.name}</Text>
                <Text style={styles.alertText}>
                  {lastLogByClient.get(client.uid)
                    ? `Última vez: ${new Date(lastLogByClient.get(client.uid)!).toLocaleDateString('es-ES')}`
                    : 'Sin entrenamientos aún'}
                </Text>
              </View>
              <Button
                title={remindersSent.has(client.uid) ? 'Enviado' : 'Recordar'}
                variant="secondary"
                onPress={() => handleSendReminder(client)}
                loading={sendingReminder === client.uid}
                disabled={remindersSent.has(client.uid)}
                style={styles.reminderBtn}
              />
            </View>
          ))
        )}
      </Card>
    </ScreenContainer>
  );
}

function StatCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <Card style={styles.statCard}>
      <Text style={[styles.statValue, warn && { color: colors.danger }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  greeting: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  statValue: { ...typography.h1, color: colors.text },
  statLabel: { ...typography.small, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  section: { marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  logRow: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  inactiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reminderBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  logClient: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold, },
  logDetail: { ...typography.small, color: colors.textMuted },
  alertText: { ...typography.small, color: colors.warning },
  mutedText: { ...typography.small, color: colors.textFaint },
});
