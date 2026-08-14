import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { colors, spacing, typography } from '../lib/theme';

export function ErrorState({
  title = 'Algo ha ido mal',
  subtitle = 'Comprueba tu conexión e inténtalo de nuevo.',
  onRetry,
}: {
  title?: string;
  subtitle?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.container}>
      <Ionicons name="cloud-offline-outline" size={30} color={colors.textFaint} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {onRetry ? (
        <Button title="Reintentar" variant="secondary" onPress={onRetry} style={styles.btn} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.xs },
  title: { ...typography.h3, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  subtitle: { ...typography.small, color: colors.textFaint, textAlign: 'center' },
  btn: { marginTop: spacing.md, minWidth: 160 },
});
