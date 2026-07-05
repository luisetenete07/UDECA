import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../lib/theme';

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <View style={compact ? styles.containerCompact : styles.container}>
      <Image
        source={require('../assets/android-icon-foreground.png')}
        style={compact ? styles.emblemCompact : styles.emblem}
        resizeMode="contain"
      />
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
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  containerCompact: {
    alignItems: 'center',
    marginBottom: spacing.md,
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
    color: colors.text,
  },
  markCompact: {
    fontSize: 22,
  },
  markAccent: {
    color: colors.primary,
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
