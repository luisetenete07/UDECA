import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { colors, spacing, typography } from '../lib/theme';

const CHART_HEIGHT = 160;

export interface LineChartPoint {
  date: number;
  value: number;
}

interface LineChartProps {
  points: LineChartPoint[];
  unit: string;
  emptyMessage: string;
  lowerIsBetter?: boolean;
}

export function LineChart({ points, unit, emptyMessage, lowerIsBetter = true }: LineChartProps) {
  if (points.length < 2) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const chartWidth = Math.max(points.length * 48, 280);
  const paddingY = 16;

  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * (chartWidth - 24) + 12;
    const y =
      CHART_HEIGHT - paddingY - ((point.value - min) / range) * (CHART_HEIGHT - paddingY * 2);
    return { x, y };
  });

  const polylinePoints = coords.map((p) => `${p.x},${p.y}`).join(' ');
  const first = points[0].value;
  const last = points[points.length - 1].value;
  const diff = last - first;
  const diffIsGood = lowerIsBetter ? diff < 0 : diff > 0;
  const diffIsBad = lowerIsBetter ? diff > 0 : diff < 0;

  return (
    <View>
      <View style={styles.summaryRow}>
        <SummaryStat label="Actual" value={`${last.toFixed(1)} ${unit}`} />
        <SummaryStat
          label="Cambio"
          value={`${diff >= 0 ? '+' : ''}${diff.toFixed(1)} ${unit}`}
          highlight={diffIsGood ? colors.accent : diffIsBad ? colors.warning : colors.textMuted}
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
          {coords.map((p, i) => (
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
