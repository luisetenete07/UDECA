import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../lib/auth-context';
import { updateClientGoal } from '../../lib/firestore/users';
import { colors, spacing, typography } from '../../lib/theme';

export default function ClientProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [goal, setGoal] = useState(profile?.goal ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveGoal = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await updateClientGoal(profile.uid, goal.trim());
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <Text style={styles.title}>Perfil</Text>

      <Card style={styles.section}>
        <Text style={styles.name}>{profile?.name}</Text>
        <Text style={styles.email}>{profile?.email}</Text>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Mi objetivo</Text>
        <TextField
          value={goal}
          onChangeText={setGoal}
          placeholder="Ej. Conseguir mi primera dominada"
        />
        {saved ? <Text style={styles.savedText}>Guardado ✓</Text> : null}
        <Button title="Guardar objetivo" variant="secondary" onPress={handleSaveGoal} loading={saving} />
      </Card>

      <Button title="Cerrar sesión" variant="danger" onPress={signOut} style={{ marginTop: spacing.lg }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.lg },
  section: { marginBottom: spacing.md },
  name: { ...typography.h2, color: colors.text },
  email: { ...typography.small, color: colors.textMuted },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.sm },
  savedText: { ...typography.small, color: colors.accent, marginBottom: spacing.sm },
});
