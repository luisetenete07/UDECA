import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../lib/theme';

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <View style={compact ? styles.containerCompact : styles.container}>
      <Text style={[styles.mark, compact && styles.markCompact]}>
        UDE<Text style={styles.markAccent}>CA</Text>
      </Text>
      <View style={styles.rule} />
      <Text style={styles.subtitle}>Universidad de Calistenia</Text>
      {!compact ? <Text style={styles.credit}>by Luis Tena</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  containerCompact: {
    marginBottom: spacing.sm,
  },
  mark: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 3,
    color: colors.text,
  },
  markCompact: {
    fontSize: 24,
  },
  markAccent: {
    color: colors.primary,
  },
  rule: {
    width: 36,
    height: 3,
    backgroundColor: colors.primary,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  credit: {
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 2,
  },
});
