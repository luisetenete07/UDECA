import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { useAuth } from '../lib/auth-context';
import { MARCA_POR_DEFECTO } from '../lib/marcaPropia';
import { Emblema, Logotipo } from './MarcaCalico';
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
  const { marca, logo } = useAuth();
  // Con sesión y logo propio, el emblema es el del entrenador.
  const suyo = !sinSesion && !!logo;
  const propia = !sinSesion && (marca !== MARCA_POR_DEFECTO || suyo);
  return (
    <View style={compact ? styles.containerCompact : styles.container}>
      {/*
        LA MARCA DE LA CASA: el logotipo de CALICO tal cual, en vector, con su
        C y sus letras dibujadas. Escrito con una fuente parecida no sería el
        logo, sería otra cosa que se le parece.

        Con marca propia, lo del entrenador: su logo (o el emblema si no tiene)
        y su nombre, con un "con CALICO" pequeño debajo — la app es suya, pero
        quien la mira sabe con qué está hecha.
      */}
      {!propia ? (
        <>
          <View style={compact ? styles.logotipoCompact : styles.logotipo}>
            <Logotipo ancho={compact ? 156 : 220} />
          </View>
          <Text style={styles.subtitle}>Calisthenics Coaches</Text>
          {!compact ? <Text style={styles.credit}>by Luis Tena</Text> : null}
        </>
      ) : (
        <>
          {suyo ? (
            <Image
              source={{ uri: logo! }}
              style={compact ? styles.emblemCompact : styles.emblem}
              resizeMode="contain"
            />
          ) : (
            <View style={compact ? styles.emblemCompact : styles.emblem}>
              <Emblema alto={compact ? 44 : 60} />
            </View>
          )}
          <Text style={[styles.mark, compact && styles.markCompact]} numberOfLines={1}>
            {marca}
          </Text>
          <View style={styles.rule} />
          <Text style={styles.credit}>con CALICO</Text>
        </>
      )}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemCompact: {
    width: 52,
    height: 52,
    marginBottom: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logotipo: { marginBottom: spacing.md },
  logotipoCompact: { marginBottom: spacing.sm },
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
