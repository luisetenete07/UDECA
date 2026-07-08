import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../lib/auth-context';
import {
  createChallenge,
  endChallenge,
  getActiveChallenge,
} from '../../lib/firestore/challenges';
import { getClientsForTrainer } from '../../lib/firestore/users';
import { getWorkoutLogsForTrainer } from '../../lib/firestore/workoutLogs';
import { notifyUser } from '../../lib/notifications';
import { fonts, colors, spacing, typography } from '../../lib/theme';
import type { Challenge, UserProfile, WorkoutLog } from '../../lib/types';

const INACTIVE_DAYS_THRESHOLD = 7;

export default function TrainerDashboard() {
  const { profile } = useAuth();
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [remindersSent, setRemindersSent] = useState<Set<string>>(new Set());
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [challengeTitle, setChallengeTitle] = useState('');
  const [challengeWeeks, setChallengeWeeks] = useState('4');
  const [savingChallenge, setSavingChallenge] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!profile) return;
      let cancelled = false;
      (async () => {
        try {
          const [clientData, logData, challengeData] = await Promise.all([
            getClientsForTrainer(profile.uid),
            getWorkoutLogsForTrainer(profile.uid),
            getActiveChallenge(profile.uid),
          ]);
          if (cancelled) return;
          setClients(clientData);
          setLogs(logData);
          setChallenge(challengeData);
        } catch (e) {
          if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
        } finally {
          if (!cancelled) setLoading(false);
        }
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

  const handleStartChallenge = async () => {
    if (!profile || !challengeTitle.trim()) return;
    setSavingChallenge(true);
    try {
      const weeks = Math.max(1, Number(challengeWeeks) || 4);
      const now = Date.now();
      await createChallenge({
        trainerId: profile.uid,
        title: challengeTitle.trim(),
        startDate: now,
        endDate: now + weeks * 7 * 24 * 60 * 60 * 1000,
      });
      setChallengeTitle('');
      setChallenge(await getActiveChallenge(profile.uid));
      clients.forEach((c) =>
        notifyUser(c.uid, 'Nuevo reto del grupo', challengeTitle.trim())
      );
      showToast('Reto lanzado');
    } finally {
      setSavingChallenge(false);
    }
  };

  const handleEndChallenge = async () => {
    if (!challenge) return;
    await endChallenge(challenge.id);
    setChallenge(null);
  };

  const handleSendReminder = async (client: UserProfile) => {
    if (!profile) return;
    setSendingReminder(client.uid);
    try {
      await notifyUser(
        client.uid,
        'Te echamos de menos',
        `${client.name.split(' ')[0]}, hace tiempo que no registras entrenamientos. ¡Retomemos el ritmo!`
      );
      setRemindersSent((prev) => new Set(prev).add(client.uid));
    } finally {
      setSendingReminder(null);
    }
  };

  return (
    <ScreenContainer>
      <Text style={styles.greeting}>Hola, {profile?.name?.split(' ')[0]}</Text>
      <Text style={styles.subtitle}>Resumen de tu negocio</Text>

      {loadError ? (
        <Card style={[styles.section, { borderColor: colors.danger }]}>
          <Text style={[styles.sectionTitle, { color: colors.danger }]}>Error al cargar datos</Text>
          <Text style={styles.mutedText}>{loadError}</Text>
        </Card>
      ) : null}

      <View style={styles.statsRow}>
        <StatCard label="Clientes activos" value={String(clients.length)} />
        <StatCard label="Entrenos (total)" value={String(logs.length)} />
        <StatCard label="Inactivos" value={String(inactiveClients.length)} warn={inactiveClients.length > 0} />
      </View>

      <Card accent style={styles.section}>
        <Text style={styles.sectionTitle}>Reto del grupo</Text>
        {challenge ? (
          <>
            <Text style={styles.logClient}>{challenge.title}</Text>
            <Text style={styles.logDetail}>
              Hasta el {new Date(challenge.endDate).toLocaleDateString('es-ES')} · el ranking
              vive en la sección Social de tus alumnos.
            </Text>
            <Button
              title="Finalizar reto"
              variant="danger"
              onPress={handleEndChallenge}
              style={{ marginTop: spacing.sm }}
            />
          </>
        ) : (
          <>
            <TextField
              placeholder="Ej: Enero imparable: máximo de sesiones"
              value={challengeTitle}
              onChangeText={setChallengeTitle}
            />
            <TextField
              label="Duración (semanas)"
              keyboardType="number-pad"
              value={challengeWeeks}
              onChangeText={setChallengeWeeks}
            />
            <Button
              title="Lanzar reto"
              onPress={handleStartChallenge}
              loading={savingChallenge}
              disabled={!challengeTitle.trim()}
            />
          </>
        )}
      </Card>

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
  announcementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  announcementDate: { ...typography.small, color: colors.textFaint, marginTop: 2 },
});
