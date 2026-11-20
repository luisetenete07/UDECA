import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { ARROBA, MARCA, MARCA_CORTA } from '../lib/marca';
import { useLayout } from '../lib/responsive';
import { colors, fonts, spacing } from '../lib/theme';

/** Ancho entre alto del tridente recortado (assets/emblema.png). */
const PROPORCION = 504 / 512;
/**
 * El color del tridente (assets/emblema.png), medido en el propio dibujo.
 * MASTERY va en este mismo color: lo pidió Luis, para que nombre y logo se
 * lean como una sola pieza y no como un dibujo y un rótulo puestos al lado.
 */
export const COLOR_DEL_TRIDENTE = '#E2DCD6';

/**
 * La firma de la app arriba a la izquierda: el tridente, MASTERY y, debajo,
 * @luistenafit.
 *
 * Lo pidió Luis tal cual: es su app, y lo primero que se lee al abrirla tiene
 * que ser suyo. Antes, en ese sitio ponía "MAESTRÍA EN CALISTENIA" y debajo el
 * rol de la cuenta ("Entrenador", "Alumno"): un rótulo de plataforma, no de
 * una persona.
 *
 * `tamano`: 'barra' para la columna lateral del ordenador, 'movil' para la
 * cabecera del inicio en el teléfono.
 */
export function MarcaMastery({ tamano = 'barra' }: { tamano?: 'barra' | 'movil' }) {
  const movil = tamano === 'movil';
  const alto = movil ? 30 : 34;
  return (
    <View style={styles.fila} accessible accessibilityLabel={`${MARCA}, ${ARROBA}`}>
      <Image
        source={require('../assets/emblema.png')}
        style={{ width: alto * PROPORCION, height: alto }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <View>
        {/* Nombres propios: no están en el diccionario, salen tal cual. */}
        <Text style={[styles.nombre, movil && styles.nombreMovil]} numberOfLines={1}>
          {MARCA_CORTA}
        </Text>
        <Text style={[styles.arroba, movil && styles.arrobaMovil]} numberOfLines={1}>
          {ARROBA}
        </Text>
      </View>
    </View>
  );
}

/**
 * La misma firma encima del inicio, pero solo en el teléfono. En el ordenador
 * y la tableta ya está en la barra lateral, justo a la izquierda: repetirla en
 * la pantalla sería ponerla dos veces una al lado de la otra.
 */
export function MarcaMasteryEnMovil() {
  const { sidebar } = useLayout();
  if (sidebar) return null;
  return (
    <View style={styles.enMovil}>
      <MarcaMastery tamano="movil" />
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nombre: {
    fontSize: 20,
    fontFamily: fonts.display,
    letterSpacing: 3.5,
    color: COLOR_DEL_TRIDENTE,
  },
  nombreMovil: { fontSize: 18, letterSpacing: 3 },
  arroba: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    letterSpacing: 0.4,
    color: colors.textMuted,
    marginTop: 1,
  },
  arrobaMovil: { fontSize: 12 },
  enMovil: { marginBottom: spacing.lg },
});
