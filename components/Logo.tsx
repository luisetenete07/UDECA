import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { useAuth } from '../lib/auth-context';
import { MARCA_POR_DEFECTO } from '../lib/marcaPropia';
import { colors, fonts, spacing } from '../lib/theme';

/**
 * El logo. Con la marca de quien mira, cuando hay alguien mirando.
 *
 * `sinSesion` lo usan las pantallas de entrar y registrarse: ahí todavía no se
 * sabe de quién es nadie, así que la marca es la de la app. En el resto —las
 * pantallas de puerta, que salen con la sesión ya abierta— se lee la del
 * entrenador o la del atleta.
 */
export function Logo({ compact, sinSesion }: { compact?: boolean; sinSesion?: boolean }) {
  const { marca } = useAuth();
  return (
    <View style={compact ? styles.containerCompact : styles.container}>
      {/* El logo, y nada más. Aquí había un halo dorado redondo por detrás, y
          en Android no se veía como un halo: `elevation` dibuja la sombra del
          sistema con la silueta de la vista, así que salía un disco amarillo
          macizo detrás del emblema. El fondo de la marca es negro; lo que hace
          que el logo destaque es el propio negro, no un aro. */}
      <Image
        source={require('../assets/android-icon-foreground.png')}
        style={compact ? styles.emblemCompact : styles.emblem}
        resizeMode="contain"
      />
      <Text style={[styles.mark, compact && styles.markCompact]} numberOfLines={1}>
        {sinSesion ? MARCA_POR_DEFECTO : marca}
      </Text>
      <View style={styles.rule} />
      {/* "Universidad de Calistenia" y la firma son de UDECA, no de quien haya
          puesto su palabra: debajo de "IRON BOX" dirían algo que no es verdad.
          Con marca propia, el logo se queda en la marca y ya. */}
      {sinSesion || marca === MARCA_POR_DEFECTO ? (
        <>
          <Text style={styles.subtitle}>Universidad de Calistenia</Text>
          {!compact ? <Text style={styles.credit}>by Luis Tena</Text> : null}
        </>
      ) : null}
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
  emblem: {
    width: 72,
    height: 72,
    marginBottom: spacing.sm,
  },
  emblemCompact: {
    width: 52,
    height: 52,
    marginBottom: spacing.xs,
  },
  mark: {
    fontSize: 30,
    fontFamily: fonts.display,
    letterSpacing: 3,
    color: colors.primary,
  },
  markCompact: {
    fontSize: 22,
  },
  rule: {
    width: 36,
    height: 2,
    backgroundColor: colors.primary,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  credit: {
    fontSize: 11,
    fontFamily: fonts.body,
    color: colors.textFaint,
    marginTop: 2,
  },
});
