import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, radius, spacing, typography } from '../lib/theme';

interface StatTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  highlight?: boolean;
}

/**
 * Cuenta de 0 al valor con easing (solo en el primer render; los refrescos
 * silenciosos posteriores saltan directos para no marear).
 */
function useCountUp(target: number, duration = 650): number {
  const [val, setVal] = useState(0);
  const animated = useRef(false);
  useEffect(() => {
    if (animated.current) {
      setVal(target);
      return;
    }
    animated.current = true;
    const t0 = Date.now();
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

/** Valor numérico animado: "1.234 kg" cuenta de 0 a 1.234 conservando sufijo. */
function AnimatedValue({ value, style }: { value: string; style: object[] }) {
  // Solo animamos enteros claros; con decimales (coma) se muestra tal cual.
  const m = /^([\d.]+)(.*)$/.exec(value);
  const plain = !m || value.includes(',');
  const target = plain ? 0 : parseInt(m![1].replace(/\./g, ''), 10);
  const hadSeparator = !plain && m![1].includes('.');
  const current = useCountUp(plain ? 0 : target);
  if (plain || !Number.isFinite(target)) return <Text style={style}>{value}</Text>;
  const shown = hadSeparator ? current.toLocaleString('es-ES') : String(current);
  return (
    <Text style={style}>
      {shown}
      {m![2]}
    </Text>
  );
}

export function StatTile({ icon, value, label, highlight }: StatTileProps) {
  return (
    <LinearGradient
      colors={highlight ? gradients.goldSubtle : gradients.surface}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.tile, highlight && styles.tileHighlight]}
    >
      <Ionicons
        name={icon}
        size={18}
        color={highlight ? colors.primary : colors.textMuted}
        style={styles.icon}
      />
      <AnimatedValue
        value={value}
        style={[styles.value, highlight ? { color: colors.primaryBright } : {}]}
      />
      <Text style={styles.label}>{label}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  tileHighlight: {
    borderColor: colors.hairline,
  },
  icon: { marginBottom: spacing.xs },
  value: { ...typography.h2, color: colors.text },
  label: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
});
