import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { colors, fonts, spacing, typography } from '../lib/theme';

const CHART_HEIGHT = 160;

export interface LineChartPoint {
  date: number;
  value: number;
  /**
   * Qué poner encima del punto en vez del número pelado: la marca tal cual se
   * hizo ("8", "45s", "8 · 20s" en un combo, "3+3+3" en clúster). Sin esto se
   * escribe el valor.
   */
  label?: string;
}

interface LineChartProps {
  points: LineChartPoint[];
  unit: string;
  emptyMessage: string;
  lowerIsBetter?: boolean;
  /** Etiqueta día + valor en los puntos clave (primero, último, mín, máx). */
  labeled?: boolean;
  /**
   * Etiqueta TODOS los puntos con su marca y su día. Es lo que convierte la
   * línea en algo que se lee: sin los números encima solo se ve la forma, y
   * "¿cuánto hice el 12 de mayo?" no se puede contestar mirando la curva.
   */
  labelAll?: boolean;
  /**
   * Fila de "Actual · Cambio · Mín/Máx" encima de la gráfica. Se puede quitar
   * cuando quien la usa ya cuenta eso mismo más arriba y con más claridad:
   * repetir el mismo número dos veces seguidas no informa, distrae.
   */
  showSummary?: boolean;
}

const shortDate = (ts: number) =>
  new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

/** Número corto: sin decimales si no los tiene ("8", no "8.0"). */
const formatValue = (v: number) =>
  (Number.isInteger(v) ? String(v) : v.toFixed(1)).replace('.', ',');

/** Índices clave a etiquetar: primero, último, mínimo y máximo (sin repetir). */
function keyIndices(values: number[]): number[] {
  const last = values.length - 1;
  let argMin = 0;
  let argMax = 0;
  values.forEach((v, i) => {
    if (v < values[argMin]) argMin = i;
    if (v > values[argMax]) argMax = i;
  });
  return Array.from(new Set([0, argMin, argMax, last])).sort((a, b) => a - b);
}

export function LineChart({
  points,
  unit,
  emptyMessage,
  lowerIsBetter = true,
  labeled = false,
  labelAll = false,
  showSummary = true,
}: LineChartProps) {
  if (points.length < 2) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  const conEtiquetas = labeled || labelAll;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  // Etiquetando todos los puntos hace falta más sitio por punto: las marcas de
  // un combo ("8 · 20s") se pisarían entre ellas con la separación normal.
  const perPoint = labelAll ? 74 : 48;
  const chartWidth = Math.max(points.length * perPoint, 280);
  // Con etiquetas dejamos más aire arriba (valor) y abajo (fecha).
  const paddingTop = conEtiquetas ? 26 : 16;
  const paddingBottom = conEtiquetas ? 30 : 16;

  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * (chartWidth - 24) + 12;
    const y =
      CHART_HEIGHT -
      paddingBottom -
      ((point.value - min) / range) * (CHART_HEIGHT - paddingTop - paddingBottom);
    return { x, y };
  });

  const labelSet = labelAll
    ? new Set(points.map((_, i) => i))
    : labeled
      ? new Set(keyIndices(values))
      : new Set<number>();

  const polylinePoints = coords.map((p) => `${p.x},${p.y}`).join(' ');
  const first = points[0].value;
  const last = points[points.length - 1].value;
  const diff = last - first;
  const diffIsGood = lowerIsBetter ? diff < 0 : diff > 0;
  const diffIsBad = lowerIsBetter ? diff > 0 : diff < 0;

  return (
    <View>
      {showSummary ? (
        <View style={styles.summaryRow}>
          <SummaryStat label="Actual" value={`${formatValue(last)} ${unit}`} />
          <SummaryStat
            label="Cambio"
            value={`${diff >= 0 ? '+' : ''}${formatValue(diff)} ${unit}`}
            highlight={diffIsGood ? colors.accent : diffIsBad ? colors.warning : colors.textMuted}
          />
          <SummaryStat label="Mín / Máx" value={`${formatValue(min)} / ${formatValue(max)}`} />
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={chartWidth} height={CHART_HEIGHT}>
          <Line
            x1={0}
            y1={CHART_HEIGHT - paddingBottom}
            x2={chartWidth}
            y2={CHART_HEIGHT - paddingBottom}
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
          {coords.map((p, i) => {
            const key = labelSet.has(i);
            return (
              <React.Fragment key={i}>
                {key ? (
                  <>
                    <SvgText
                      x={p.x}
                      y={Math.max(11, p.y - 9)}
                      fontSize={10}
                      fontFamily={fonts.semiBold}
                      fill={colors.primaryBright}
                      textAnchor="middle"
                    >
                      {points[i].label ?? formatValue(points[i].value)}
                    </SvgText>
                    <SvgText
                      x={p.x}
                      y={CHART_HEIGHT - 8}
                      fontSize={9}
                      fill={colors.textFaint}
                      textAnchor="middle"
                    >
                      {shortDate(points[i].date)}
                    </SvgText>
                  </>
                ) : null}
                <Circle cx={p.x} cy={p.y} r={key ? 4 : 3} fill={colors.primary} />
              </React.Fragment>
            );
          })}
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
