import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { colors, spacing, typography } from '../lib/theme';
import type { WeightLog } from '../lib/types';

const CHART_HEIGHT = 160;

export function WeightChart({ logs }: { logs: WeightLog[] }) {
  if (logs.length < 2) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          Registra al menos dos pesajes para ver tu gráfica de evolución.
        </Text>
      </View>
    );
  }

  const weights = logs.map((l) => l.weightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const chartWidth = Math.max(logs.length * 48, 280);
  const paddingY = 16;

  const points = logs.map((log, index) => {
    const x = (index / (logs.length - 1)) * (chartWidth - 24) + 12;
    const y =
      CHART_HEIGHT -
      paddingY -
      ((log.weightKg - min) / range) * (CHART_HEIGHT - paddingY * 2);
    return { x, y, weight: log.weightKg };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');
  const first = logs[0].weightKg;
  const last = logs[logs.length - 1].weightKg;
  const diff = last - first;

  return (
    <View>
      <View style={styles.summaryRow}>
        <SummaryStat label="Actual" value={`${last.toFixed(1)} kg`} />
        <SummaryStat
          label="Cambio"
          value={`${diff >= 0 ? '+' : ''}${diff.toFixed(1)} kg`}
          highlight={diff < 0 ? colors.accent : diff > 0 ? colors.warning : colors.textMuted}
        />
        <SummaryStat label="Mín / Máx" value={`${min.toFixed(1)} / ${max.toFixed(1)}`} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={chartWidth} height={CHART_HEIGHT}>
          <Line
            x1={0}
            y1={CHART_HEIGHT - paddingY}
            x2={chartWidth}
            y2={CHART_HEIGHT - paddingY}
            stroke={colors.border}
            strokeWidth={1}
          />
          <Polyline
            points={polylinePoints}
            fill="none"
            stroke={colors.primary}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={colors.primary} />
          ))}
        </Svg>
      </ScrollView>
    </View>
  );
}

function SummaryStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: string;
}) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, highlight ? { color: highlight } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    paddingVertical: spacing.lg,
  },
  emptyText: {
    ...typography.small,
    color: colors.textFaint,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  summaryStat: {
    alignItems: 'center',
  },
  summaryLabel: {
    ...typography.label,
    color: colors.textFaint,
    marginBottom: 2,
  },
  summaryValue: {
    ...typography.h3,
    color: colors.text,
  },
});
