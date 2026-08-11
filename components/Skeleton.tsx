import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';
import { colors, radius, spacing } from '../lib/theme';

function Bar({ width, height = 16 }: { width: DimensionValue; height?: number }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.bar, { width, height, opacity }]} />;
}

/** Placeholder animado para listas mientras cargan (más elegante que un spinner). */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.row}>
          <Animated.View style={styles.avatar} />
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Bar width="60%" />
            <Bar width="40%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  panelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  circle: { width: 92, height: 92, borderRadius: 46, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceAlt },
  bar: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm },
});

/**
 * El esqueleto de una pantalla de tarjetas, que es la forma de casi todas las
 * del alumno: un título arriba y unas cuantas fichas debajo.
 *
 * Existe para que dejen de quedarse en blanco mientras cargan. El logo latiendo
 * dice "espera"; esto dice "ya llega, y va a tener esta pinta", y de paso el
 * ojo ya está colocando dónde va cada cosa cuando aparece.
 */
export function CardsSkeleton({ tarjetas = 3 }: { tarjetas?: number }) {
  return (
    <View style={{ gap: spacing.md }}>
      <Bar width="50%" height={28} />
      {Array.from({ length: tarjetas }).map((_, i) => (
        <View key={i} style={styles.card}>
          <Bar width="45%" height={14} />
          <Bar width="100%" height={11} />
          <Bar width="75%" height={11} />
        </View>
      ))}
    </View>
  );
}

/**
 * El esqueleto del panel: una alerta, el bloque grande con su círculo y dos
 * tarjetas. Imita la pantalla de verdad para que al llegar los datos nada
 * salte de sitio.
 *
 * No es maquillaje: una rueda girando dice "espera"; un esqueleto dice "ya
 * llega, y va a tener esta pinta". Se percibe más rápido aunque tarde
 * exactamente lo mismo, que es la parte de la velocidad que sí se arregla
 * desde el diseño.
 */
export function DashboardSkeleton() {
  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.card}>
        <Bar width="45%" height={13} />
        <Bar width="70%" height={11} />
      </View>
      <View style={styles.card}>
        <View style={styles.panelRow}>
          <View style={styles.circle}>
            <Bar width={92} height={92} />
          </View>
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Bar width="60%" height={12} />
            <Bar width="85%" height={20} />
            <Bar width="70%" height={11} />
          </View>
        </View>
      </View>
      <View style={styles.card}>
        <Bar width="40%" height={13} />
        <Bar width="100%" height={11} />
        <Bar width="80%" height={11} />
      </View>
    </View>
  );
}
