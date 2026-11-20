import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MarcaMastery } from './MarcaMastery';
import { colors, spacing } from '../lib/theme';

/** Alto reservado para la marca en la cabecera de la barra lateral. */
export const BRAND_HEIGHT = 96;

/**
 * La marca en la cabecera de la barra lateral de escritorio: el tridente,
 * MASTERY y @luistenafit (components/MarcaMastery.tsx).
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
        <MarcaMastery />
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
    height: BRAND_HEIGHT - spacing.md,
    paddingHorizontal: spacing.md,
  },
  // Separa la marca de los destinos: sin esta línea, el emblema parece el
  // primero de la lista en vez de la cabecera de la columna.
  rule: {
    marginHorizontal: spacing.md,
    height: 1,
    backgroundColor: colors.hairlineFaint,
  },
});
