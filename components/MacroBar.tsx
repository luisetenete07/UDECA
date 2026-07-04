import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../lib/theme';

interface MacroBarProps {
  label: string;
  consumed: number;
  target: number;
  unit: string;
  color?: string;
}

export function MacroBar({ label, consumed, target, unit, color = colors.primary }: MacroBarProps) {
  const ratio = target > 0 ? Math.min(consumed / target, 1) : 0;
  const overTarget = target > 0 && consumed > target;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, overTarget && { color: colors.warning }]}>
          {Math.round(consumed)} / {Math.round(target)} {unit}
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${ratio * 100}%`, backgroundColor: overTarget ? colors.warning : color },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.sm },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  label: { ...typography.small, color: colors.textMuted, fontWeight: '600' },
  value: { ...typography.small, color: colors.text, fontWeight: '600' },
  track: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
  },
});
