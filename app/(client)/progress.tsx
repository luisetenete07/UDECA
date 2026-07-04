import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { LineChart } from '../../components/LineChart';
import { LoadingScreen } from '../../components/LoadingScreen';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { WeightChart } from '../../components/WeightChart';
import { useAuth } from '../../lib/auth-context';
import { createMeasurement, getMeasurementsForClient } from '../../lib/firestore/measurements';
import { createWeightLog, getWeightLogsForClient } from '../../lib/firestore/weightLogs';
import { colors, radius, spacing, typography } from '../../lib/theme';
import type { BodyMeasurement, WeightLog } from '../../lib/types';

type Tab = 'weight' | 'measurements';

export default function ProgressScreen() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('weight');
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [loading, setLoading] = useState(true);

  const [weightInput, setWeightInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');
  const [arm, setArm] = useState('');
  const [thigh, setThigh] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const [weightData, measurementData] = await Promise.all([
      getWeightLogsForClient(profile.uid),
      getMeasurementsForClient(profile.uid),
    ]);
    setWeightLogs(weightData);
    setMeasurements(measurementData);
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

  const handleAddMeasurement = async () => {
    if (!profile) return;
    const values = { chestCm: chest, waistCm: waist, hipsCm: hips, armCm: arm, thighCm: thigh };
    const hasAny = Object.values(values).some((v) => v.trim() !== '');
    if (!hasAny) {
      setError('Rellena al menos una medida.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createMeasurement({
        trainerId: profile.trainerId ?? '',
        clientId: profile.uid,
        date: Date.now(),
        chestCm: chest ? Number(chest) : undefined,
        waistCm: waist ? Number(waist) : undefined,
        hipsCm: hips ? Number(hips) : undefined,
        armCm: arm ? Number(arm) : undefined,
        thighCm: thigh ? Number(thigh) : undefined,
      });
      setChest('');
      setWaist('');
      setHips('');
      setArm('');
      setThigh('');
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen />;

  const waistPoints = measurements
    .filter((m) => m.waistCm !== undefined)
    .map((m) => ({ date: m.date, value: m.waistCm as number }));

  return (
    <ScreenContainer>
      <Text style={styles.title}>Mi progreso</Text>

      <View style={styles.tabs}>
        <TabButton label="Peso" active={tab === 'weight'} onPress={() => setTab('weight')} />
        <TabButton
          label="Medidas"
          active={tab === 'measurements'}
          onPress={() => setTab('measurements')}
        />
      </View>

      {tab === 'weight' ? (
        <>
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Evolución del peso</Text>
            <WeightChart logs={weightLogs} />
          </Card>

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Registrar peso</Text>
            <TextField
              placeholder="Peso en kg"
              keyboardType="numeric"
              value={weightInput}
              onChangeText={setWeightInput}
            />
            <TextField placeholder="Notas (opcional)" value={notesInput} onChangeText={setNotesInput} />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Guardar registro" onPress={handleAddWeight} loading={saving} />
          </Card>

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Historial</Text>
            {weightLogs.length === 0 ? (
              <EmptyState title="Todavía no has registrado tu peso" />
            ) : (
              [...weightLogs].reverse().map((log) => (
                <View key={log.id} style={styles.logRow}>
                  <Text style={styles.logValue}>{log.weightKg} kg</Text>
                  <Text style={styles.logDate}>
                    {new Date(log.date).toLocaleDateString('es-ES')}
                  </Text>
                </View>
              ))
            )}
          </Card>
        </>
      ) : (
        <>
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Evolución de cintura</Text>
            <LineChart
              points={waistPoints}
              unit="cm"
              emptyMessage="Registra al menos dos medidas de cintura para ver tu evolución."
            />
          </Card>

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Registrar medidas (cm)</Text>
            <View style={styles.row}>
              <TextField
                placeholder="Pecho"
                keyboardType="numeric"
                value={chest}
                onChangeText={setChest}
                style={styles.smallField}
              />
              <TextField
                placeholder="Cintura"
                keyboardType="numeric"
                value={waist}
                onChangeText={setWaist}
                style={styles.smallField}
              />
            </View>
            <View style={styles.row}>
              <TextField
                placeholder="Cadera"
                keyboardType="numeric"
                value={hips}
                onChangeText={setHips}
                style={styles.smallField}
              />
              <TextField
                placeholder="Brazo"
                keyboardType="numeric"
                value={arm}
                onChangeText={setArm}
                style={styles.smallField}
              />
              <TextField
                placeholder="Muslo"
                keyboardType="numeric"
                value={thigh}
                onChangeText={setThigh}
                style={styles.smallField}
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Guardar medidas" onPress={handleAddMeasurement} loading={saving} />
          </Card>

          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Historial</Text>
            {measurements.length === 0 ? (
              <EmptyState title="Todavía no has registrado medidas" />
            ) : (
              [...measurements].reverse().map((m) => (
                <View key={m.id} style={styles.logRow}>
                  <Text style={styles.logValue}>
                    {[
                      m.chestCm ? `Pecho ${m.chestCm}` : null,
                      m.waistCm ? `Cintura ${m.waistCm}` : null,
                      m.hipsCm ? `Cadera ${m.hipsCm}` : null,
                      m.armCm ? `Brazo ${m.armCm}` : null,
                      m.thighCm ? `Muslo ${m.thighCm}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <Text style={styles.logDate}>{new Date(m.date).toLocaleDateString('es-ES')}</Text>
                </View>
              ))
            )}
          </Card>
        </>
      )}
    </ScreenContainer>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tabButton, active && styles.tabButtonActive]}>
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.md },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.xs,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabButton: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  tabButtonActive: { backgroundColor: colors.primary },
  tabButtonText: { ...typography.small, fontWeight: '700', color: colors.textMuted },
  tabButtonTextActive: { color: colors.text },
  section: { marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  smallField: { flex: 1 },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.sm },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  logValue: { ...typography.body, color: colors.text, fontWeight: '700', flex: 1, marginRight: spacing.sm },
  logDate: { ...typography.small, color: colors.textMuted },
});
