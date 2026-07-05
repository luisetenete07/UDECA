import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../lib/theme';

interface StatTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  highlight?: boolean;
}

export function StatTile({ icon, value, label, highlight }: StatTileProps) {
  return (
    <View style={styles.tile}>
      <Ionicons
        name={icon}
        size={18}
        color={highlight ? colors.primary : colors.textMuted}
        style={styles.icon}
      />
      <Text style={[styles.value, highlight && { color: colors.primary }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
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
