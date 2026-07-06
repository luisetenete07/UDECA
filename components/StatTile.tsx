import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius, spacing, typography } from '../lib/theme';

interface StatTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  highlight?: boolean;
}

export function StatTile({ icon, value, label, highlight }: StatTileProps) {
  return (
    <LinearGradient
      colors={highlight ? gradients.goldSubtle : gradients.surface}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.tile, highlight && styles.tileHighlight]}
    >
      <Ionicons
        name={icon}
        size={18}
        color={highlight ? colors.primary : colors.textMuted}
        style={styles.icon}
      />
      <Text style={[styles.value, highlight && { color: colors.primaryBright }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  tileHighlight: {
    borderColor: colors.hairline,
  },
  icon: { marginBottom: spacing.xs },
  value: { ...typography.h2, color: colors.text },
  label: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
});
