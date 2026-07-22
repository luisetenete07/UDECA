import React, { useMemo } from 'react';
import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { EmptyState } from '../../../components/EmptyState';
import { METHODOLOGY } from '../../../lib/methodology';
import { colors, fonts, radius, spacing, typography } from '../../../lib/theme';

export default function MethodSectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const section = useMemo(() => METHODOLOGY.find((s) => s.id === id), [id]);

  if (!section) {
    return (
      <ScreenContainer>
        <Stack.Screen options={{ title: 'Metodología' }} />
        <EmptyState icon="book-outline" title="No encontrado" subtitle="Esta sección no existe." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: section.title }} />
      <Text style={styles.cat}>{section.category}</Text>
      <Text style={styles.title}>{section.title}</Text>
      {section.subtitle ? <Text style={styles.subtitle}>{section.subtitle}</Text> : null}

      <View style={{ marginTop: spacing.md }}>
        {section.blocks.map((b, i) => {
          if (b.kind === 'heading') {
            return (
              <Text key={i} style={styles.heading}>
                {b.text}
              </Text>
            );
          }
          if (b.kind === 'text') {
            return (
              <Text key={i} style={styles.paragraph}>
                {b.text}
              </Text>
            );
          }
          // row: primera celda = etiqueta; resto = valor(es).
          const cells = b.cells ?? [];
          const label = cells[0] ?? '';
          const rest = cells.slice(1).filter(Boolean);
          return (
            <View key={i} style={styles.row}>
              <Text style={styles.rowLabel}>{label}</Text>
              {rest.length > 0 ? (
                <Text style={styles.rowValue}>{rest.join('  ·  ')}</Text>
              ) : null}
            </View>
          );
        })}
      </View>
      <View style={{ height: spacing.xl }} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  cat: { ...typography.label, color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { ...typography.h1, color: colors.text, marginTop: 2 },
  subtitle: { ...typography.small, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 20 },
  heading: {
    ...typography.h3,
    color: colors.primaryBright,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  paragraph: { ...typography.body, color: colors.textMuted, lineHeight: 22, marginBottom: spacing.sm },
  row: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowLabel: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  rowValue: { ...typography.small, color: colors.textMuted, marginTop: 3, lineHeight: 20 },
});
