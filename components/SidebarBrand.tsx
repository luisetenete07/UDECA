import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { useAuth } from '../lib/auth-context';
import { rotuloDelRol } from '../lib/carne';
import { MARCA, MARCA_ABAJO, MARCA_ARRIBA } from '../lib/marca';
import { colors, fonts, spacing } from '../lib/theme';

/** Alto reservado para la marca en la cabecera de la barra lateral. */
export const BRAND_HEIGHT = 96;

/**
 * El nombre de la app en la cabecera de la barra lateral de escritorio.
 *
 * Va como fondo de la barra (`tabBarBackground`) porque la navegación no ofrece
 * ninguna ranura para meter contenido propio encima de los destinos. Por eso la
 * barra reserva `BRAND_HEIGHT` de relleno superior: el emblema se pinta detrás,
 * en ese hueco, y los destinos empiezan justo debajo sin solaparse.
 *
 * No es decoración: una columna de navegación que arranca directamente con
 * "Inicio" se siente como un menú suelto, no como un producto.
 *
 * Debajo de la marca va lo que ERES, no lo que es la app: "Entrenador",
 * "Atleta" o "Alumno" según la cuenta. Estaba escrito a fuego como
 * "Entrenador" para todos, así que un alumno abría la app y lo primero que
 * leía arriba a la izquierda era un cargo que no es el suyo.
 */
export function SidebarBrand() {
  const { profile } = useAuth();
  return (
    <View style={styles.fill} pointerEvents="none">
      <View style={styles.row} accessibilityLabel={MARCA}>
        <Image
          source={require('../assets/emblema.png')}
          style={styles.tridente}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <View>
          {/* El nombre en dos líneas, como en las pantallas de entrada: en una
              sola, con el espaciado de rótulo, no cabe en la columna. */}
          <Text style={styles.mark} numberOfLines={1}>
            {MARCA_ARRIBA}
          </Text>
          <Text style={styles.markAbajo} numberOfLines={1}>
            {MARCA_ABAJO}
          </Text>
          <Text style={[styles.sub, { marginTop: 6 }]}>{rotuloDelRol(profile)}</Text>
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
  tridente: { width: 34 * (504 / 512), height: 34 },
  mark: {
    fontSize: 19,
    fontFamily: fonts.display,
    letterSpacing: 3,
    color: colors.primary,
  },
  markAbajo: {
    fontSize: 8,
    fontFamily: fonts.semiBold,
    letterSpacing: 2.6,
    color: colors.textMuted,
    marginTop: 1,
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
