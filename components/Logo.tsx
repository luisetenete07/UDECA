import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { FIRMA, MARCA, MARCA_ABAJO, MARCA_ARRIBA } from '../lib/marca';
import { colors, fonts, spacing } from '../lib/theme';

/**
 * El logo: el tridente y, debajo, el nombre como rótulo ("MAESTRÍA" grande y
 * "EN CALISTENIA" debajo).
 *
 * El nombre va partido en dos líneas porque las veintidós letras seguidas, con
 * el espaciado de un rótulo, no caben en un móvil de 320 px sin bajar tanto el
 * tamaño que deja de parecer un nombre.
 */
const TRIDENTE = require('../assets/emblema.png');
/** Ancho entre alto del tridente recortado (assets/emblema.png). */
const PROPORCION = 504 / 512;
export function Logo({ compact }: { compact?: boolean }) {
  return (
    <View
      style={compact ? styles.containerCompact : styles.container}
      accessibilityRole="header"
      accessibilityLabel={MARCA}
    >
      <Image
        source={TRIDENTE}
        style={compact ? styles.tridenteCompact : styles.tridente}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <Text style={[styles.arriba, compact && styles.arribaCompact]} numberOfLines={1}>
        {MARCA_ARRIBA}
      </Text>
      <Text style={[styles.abajo, compact && styles.abajoCompact]} numberOfLines={1}>
        {MARCA_ABAJO}
      </Text>
      {!compact ? <Text style={styles.credit}>{FIRMA}</Text> : null}
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
  tridente: { width: 64 * PROPORCION, height: 64, marginBottom: spacing.md },
  tridenteCompact: { width: 44 * PROPORCION, height: 44, marginBottom: spacing.sm },
  arriba: {
    fontSize: 34,
    fontFamily: fonts.display,
    letterSpacing: 5,
    color: colors.primary,
  },
  arribaCompact: { fontSize: 26, letterSpacing: 4 },
  abajo: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    letterSpacing: 4.5,
    color: colors.textMuted,
    marginTop: 2,
  },
  abajoCompact: { fontSize: 10, letterSpacing: 3.5 },
  credit: {
    fontSize: 11,
    fontFamily: fonts.body,
    color: colors.textFaint,
    marginTop: spacing.sm,
  },
});
