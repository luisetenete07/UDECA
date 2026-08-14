import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { colors, fonts, shadows, spacing } from '../lib/theme';

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <View style={compact ? styles.containerCompact : styles.container}>
      <View style={!compact && styles.emblemGlow}>
        <Image
          source={require('../assets/android-icon-foreground.png')}
          style={compact ? styles.emblemCompact : styles.emblem}
          resizeMode="contain"
        />
      </View>
      <Text style={[styles.mark, compact && styles.markCompact]}>UDECA</Text>
      <View style={styles.rule} />
      <Text style={styles.subtitle}>Universidad de Calistenia</Text>
      {!compact ? <Text style={styles.credit}>by Luis Tena</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  containerCompact: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emblemGlow: {
    borderRadius: 999,
    ...shadows.glowGold,
  },
  emblem: {
    width: 72,
    height: 72,
    marginBottom: spacing.sm,
  },
  emblemCompact: {
    width: 52,
    height: 52,
    marginBottom: spacing.xs,
  },
  mark: {
    fontSize: 30,
    fontFamily: fonts.display,
    letterSpacing: 3,
    color: colors.primary,
  },
  markCompact: {
    fontSize: 22,
  },
  rule: {
    width: 36,
    height: 2,
    backgroundColor: colors.primary,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  credit: {
    fontSize: 11,
    fontFamily: fonts.body,
    color: colors.textFaint,
    marginTop: 2,
  },
});
