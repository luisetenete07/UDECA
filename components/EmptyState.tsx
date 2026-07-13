import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PopIn } from './FadeIn';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  /** Icono ilustrativo opcional (se muestra en un halo dorado). */
  icon?: keyof typeof Ionicons.glyphMap;
  /** CTA opcional: texto + acción. */
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Estado vacío elegante: icono ilustrativo en halo, título, subtítulo y una
 * acción opcional. Sin icono ni acción se comporta como antes (compatible).
 */
export function EmptyState({ title, subtitle, icon, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon ? (
        <PopIn>
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={30} color={colors.primary} />
          </View>
        </PopIn>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.action} hitSlop={6}>
          <Text style={styles.actionText}>{actionLabel}</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h3,
    color: colors.textMuted,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.small,
    color: colors.textFaint,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 300,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  actionText: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
});
