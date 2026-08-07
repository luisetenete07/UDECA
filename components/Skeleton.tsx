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
  saludo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatarGrande: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden' },
  hoy: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  boton: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden' },
  pesoFila: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});

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

/**
 * El esqueleto del inicio del ALUMNO.
 *
 * El esqueleto llegó al panel del entrenador y se quedó ahí: el alumno —que
 * abre la app cada día para entrenar— seguía viendo una rueda girando. La misma
 * razón vale para los dos, y para él incluso más, porque su primera pantalla
 * tiene una forma muy marcada: el saludo, la tarjeta grande de "hoy toca" con su
 * botón redondo, la semana con su anillo y la fila del peso. Imitar ESA forma
 * hace que al llegar los datos no salte nada de sitio.
 */
export function ClientHomeSkeleton() {
  return (
    <View style={{ gap: spacing.md }}>
      {/* Saludo y avatar */}
      <View style={styles.saludo}>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Bar width="35%" height={11} />
          <Bar width="55%" height={24} />
        </View>
        <View style={styles.avatarGrande}>
          <Bar width={52} height={52} />
        </View>
      </View>

      {/* "Hoy toca": la tarjeta que manda, con su botón redondo a la derecha. */}
      <View style={[styles.card, styles.hoy]}>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Bar width="40%" height={11} />
          <Bar width="70%" height={22} />
          <Bar width="55%" height={11} />
        </View>
        <View style={styles.boton}>
          <Bar width={56} height={56} />
        </View>
      </View>

      {/* La semana: anillo a la izquierda y texto al lado. */}
      <View style={styles.card}>
        <View style={styles.panelRow}>
          <View style={styles.circle}>
            <Bar width={92} height={92} />
          </View>
          <View style={{ flex: 1, gap: spacing.sm }}>
            <Bar width="45%" height={11} />
            <Bar width="80%" height={18} />
            <Bar width="60%" height={11} />
          </View>
        </View>
      </View>

      <View style={styles.pesoFila}>
        <Bar width="30%" height={13} />
      </View>
    </View>
  );
}
