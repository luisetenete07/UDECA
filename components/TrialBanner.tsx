import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { subscriptionCheckoutUrl, subscriptionState } from '../lib/subscription';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';
import type { UserProfile } from '../lib/types';

/**
 * Aviso de la prueba gratuita. No bloquea nada: informa de los días que quedan
 * y deja el pago a un toque, para que la decisión se tome habiendo usado ya la
 * app y sin tener que ir a buscarla. Desaparece en cuanto se paga.
 */
export function TrialBanner({ profile }: { profile: UserProfile | null }) {
  const sub = subscriptionState(profile);
  if (!sub.trial || !sub.active) return null;

  const days = sub.daysLeft ?? 0;
  const url = subscriptionCheckoutUrl(profile);
  // El último día se avisa con más énfasis (es cuando se decide).
  const urgent = days <= 2;

  return (
    <View style={[styles.card, urgent && styles.cardUrgent]}>
      <Ionicons
        name={urgent ? 'alarm-outline' : 'sparkles-outline'}
        size={18}
        color={urgent ? colors.warning : colors.primary}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>
          {days <= 1 ? 'Último día de prueba' : `Te quedan ${days} días de prueba`}
        </Text>
        <Text style={styles.subtitle}>Actívala y sigue con todo tu progreso y tus alumnos.</Text>
      </View>
      {url ? (
        <Pressable onPress={() => Linking.openURL(url)} style={styles.action} hitSlop={6}>
          <Text style={styles.actionText}>Activar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardUrgent: { borderColor: colors.warningMuted },
  title: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  subtitle: { ...typography.small, color: colors.textMuted, marginTop: 1 },
  action: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  actionText: { ...typography.small, color: colors.onPrimary, fontFamily: fonts.semiBold },
});
