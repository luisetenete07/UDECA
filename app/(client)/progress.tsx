import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { WeightChart } from '../../components/WeightChart';
import { useAuth } from '../../lib/auth-context';
import { createWeightLog, getWeightLogsForClient } from '../../lib/firestore/weightLogs';
import { colors, spacing, typography } from '../../lib/theme';
import type { WeightLog } from '../../lib/types';

export default function ProgressScreen() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [weightInput, setWeightInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const data = await getWeightLogsForClient(profile.uid);
    setLogs(data);
    setLoading(false);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleAddWeight = async () => {
    if (!profile) return;
    const parsed = Number(weightInput.replace(',', '.'));
    if (!parsed || parsed <= 0) {
      setError('Introduce un peso válido en kg.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createWeightLog({
        trainerId: profile.trainerId ?? '',
        clientId: profile.uid,
        date: Date.now(),
        weightKg: parsed,
        notes: notesInput.trim() || undefined,
      });
      setWeightInput('');
      setNotesInput('');
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <ScreenContainer>
      <Text style={styles.title}>Mi progreso</Text>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Evolución del peso</Text>
        <WeightChart logs={logs} />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Registrar peso</Text>
        <View style={styles.row}>
          <TextField
            placeholder="Peso en kg"
            keyboardType="numeric"
            value={weightInput}
            onChangeText={setWeightInput}
            style={styles.weightInput}
          />
        </View>
        <TextField
          placeholder="Notas (opcional)"
          value={notesInput}
          onChangeText={setNotesInput}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Guardar registro" onPress={handleAddWeight} loading={saving} />
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Historial</Text>
        {logs.length === 0 ? (
          <EmptyState title="Todavía no has registrado tu peso" />
        ) : (
          [...logs].reverse().map((log) => (
            <View key={log.id} style={styles.logRow}>
              <Text style={styles.logWeight}>{log.weightKg} kg</Text>
              <Text style={styles.logDate}>{new Date(log.date).toLocaleDateString('es-ES')}</Text>
            </View>
          ))
        )}
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.lg },
  section: { marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  weightInput: { flex: 1 },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.sm },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  logWeight: { ...typography.body, color: colors.text, fontWeight: '700' },
  logDate: { ...typography.small, color: colors.textMuted },
});
