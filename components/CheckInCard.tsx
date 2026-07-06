import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { Card } from './Card';
import { TextField } from './TextField';
import { createCheckIn } from '../lib/firestore/checkins';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import { CHECKIN_FIELDS, type UserProfile } from '../lib/types';

type Ratings = { energy: number; sleep: number; adherence: number; soreness: number };

/**
 * Tarjeta de check-in semanal del alumno. Se muestra en su inicio cuando
 * todavía no ha enviado el de esta semana; al enviarlo desaparece hasta la
 * semana siguiente.
 */
export function CheckInCard({ profile, onDone }: { profile: UserProfile; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [ratings, setRatings] = useState<Ratings>({
    energy: 0,
    sleep: 0,
    adherence: 0,
    soreness: 0,
  });
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = CHECKIN_FIELDS.every((f) => ratings[f.key] > 0);

  const handleSubmit = async () => {
    if (!profile.trainerId) return;
    if (!complete) {
      setError('Valora los cuatro apartados para enviar tu check-in.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createCheckIn({
        trainerId: profile.trainerId,
        clientId: profile.uid,
        ...ratings,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)}>
        <Card accent style={styles.card}>
          <View style={styles.headerRow}>
            <Ionicons name="clipboard-outline" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Check-in semanal</Text>
              <Text style={styles.subtitle}>
                Cuéntale a tu entrenador cómo ha ido la semana. Un minuto.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </View>
        </Card>
      </Pressable>
    );
  }

  return (
    <Card accent style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="clipboard-outline" size={18} color={colors.primary} />
        <Text style={[styles.title, { flex: 1 }]}>Check-in semanal</Text>
        <Pressable onPress={() => setOpen(false)} hitSlop={8}>
          <Ionicons name="close" size={18} color={colors.textFaint} />
        </Pressable>
      </View>

      {CHECKIN_FIELDS.map((field) => (
        <View key={field.key} style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>{field.label}</Text>
          <View style={styles.dots}>
            {[1, 2, 3, 4, 5].map((n) => {
              const active = ratings[field.key] >= n;
              return (
                <Pressable
                  key={n}
                  onPress={() => setRatings((r) => ({ ...r, [field.key]: n }))}
                  style={[styles.dot, active && styles.dotActive]}
                  hitSlop={4}
                >
                  <Text style={[styles.dotText, active && styles.dotTextActive]}>{n}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <TextField
        label="¿Algo que deba saber tu entrenador?"
        value={notes}
        onChangeText={setNotes}
        placeholder="Molestias, viajes, motivación... (opcional)"
        multiline
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Enviar check-in" onPress={handleSubmit} loading={saving} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: { ...typography.h3, color: colors.text },
  subtitle: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  fieldRow: { marginBottom: spacing.sm },
  fieldLabel: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  dots: { flexDirection: 'row', gap: spacing.xs },
  dot: {
    flex: 1,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  dotActive: { backgroundColor: colors.primaryMuted, borderColor: colors.hairline },
  dotText: { ...typography.small, color: colors.textFaint, fontFamily: fonts.semiBold },
  dotTextActive: { color: colors.primaryBright },
  error: { ...typography.small, color: colors.danger, marginBottom: spacing.sm },
});
