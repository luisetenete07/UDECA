import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../lib/theme';

/** Alto reservado para la marca en la cabecera de la barra lateral. */
export const BRAND_HEIGHT = 96;

/**
 * Marca UDECA en la cabecera de la barra lateral de escritorio.
 *
 * Va como fondo de la barra (`tabBarBackground`) porque la navegación no ofrece
 * ninguna ranura para meter contenido propio encima de los destinos. Por eso la
 * barra reserva `BRAND_HEIGHT` de relleno superior: el emblema se pinta detrás,
 * en ese hueco, y los destinos empiezan justo debajo sin solaparse.
 *
 * No es decoración: una columna de navegación que arranca directamente con
 * "Inicio" se siente como un menú suelto, no como un producto.
 */
export function SidebarBrand() {
  return (
    <View style={styles.fill} pointerEvents="none">
      <View style={styles.row}>
        <Image
          source={require('../assets/android-icon-foreground.png')}
          style={styles.emblem}
          resizeMode="contain"
        />
        <View>
          <Text style={styles.mark}>UDECA</Text>
          <Text style={styles.sub}>Entrenador</Text>
        </View>
      </View>
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: BRAND_HEIGHT - spacing.md,
    paddingHorizontal: spacing.md,
  },
  emblem: { width: 34, height: 34 },
  mark: {
    fontSize: 19,
    fontFamily: fonts.display,
    letterSpacing: 2,
    color: colors.primary,
  },
  sub: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textFaint,
    marginTop: 1,
  },
  // Separa la marca de los destinos: sin esta línea, el emblema parece el
  // primero de la lista en vez de la cabecera de la columna.
  rule: {
    marginHorizontal: spacing.md,
    height: 1,
    backgroundColor: colors.hairlineFaint,
  },
});
