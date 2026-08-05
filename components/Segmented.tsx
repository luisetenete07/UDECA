import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * Un selector de dos o tres opciones, y el mismo en toda la app.
 *
 * Había tres versiones distintas de esto —la agenda, la rutina, el plan del
 * atleta— con paletas parecidas y medidas que no coincidían: mismo control,
 * distinta altura y distinta letra según en qué pantalla estuvieras. Eso es lo
 * que hace que una app se sienta cosida a mano aunque cada pantalla, por
 * separado, esté bien.
 *
 * La pastilla se DESLIZA de una opción a otra en vez de aparecer en la nueva.
 * Cuesta lo mismo de programar y cambia lo que se entiende: apareciendo, son
 * dos botones que se encienden; deslizándose, es una sola cosa que se mueve, y
 * el ojo sigue el movimiento sin tener que releer nada.
 */

export interface OpcionSegmento<T extends string> {
  valor: T;
  texto: string;
  icono?: React.ComponentProps<typeof Ionicons>['name'];
  /** Cifra pequeña a la derecha (p. ej. tareas pendientes). */
  contador?: number;
}

export function Segmented<T extends string>({
  opciones,
  valor,
  onChange,
  compacto = false,
}: {
  opciones: OpcionSegmento<T>[];
  valor: T;
  onChange: (v: T) => void;
  /** Letra y altura menores, para cabeceras densas. */
  compacto?: boolean;
}) {
  const [ancho, setAncho] = useState(0);
  const indice = Math.max(0, opciones.findIndex((o) => o.valor === valor));
  const desliz = useRef(new Animated.Value(indice)).current;

  useEffect(() => {
    const a = Animated.timing(desliz, {
      toValue: indice,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [desliz, indice]);

  // Los segmentos reparten el ancho a partes iguales, así que la pastilla se
  // calcula y no hace falta medir uno por uno.
  const anchoSeg = opciones.length > 0 ? (ancho - PADDING * 2) / opciones.length : 0;

  return (
    <View style={styles.caja} onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
      {anchoSeg > 0 ? (
        <Animated.View
          style={[
            styles.pastilla,
            {
              width: anchoSeg,
              height: compacto ? ALTO_COMPACTO : ALTO,
              transform: [
                {
                  translateX: desliz.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, anchoSeg],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="none"
        />
      ) : null}

      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            onPress={() => {
              if (o.valor === valor) return;
              if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
              onChange(o.valor);
            }}
            style={[styles.segmento, { height: compacto ? ALTO_COMPACTO : ALTO }]}
          >
            {o.icono ? (
              <Ionicons
                name={o.icono}
                size={compacto ? 13 : 15}
                color={activo ? colors.onPrimary : colors.textMuted}
              />
            ) : null}
            <Text
              style={[
                styles.texto,
                compacto && styles.textoCompacto,
                activo && styles.textoActivo,
              ]}
              numberOfLines={1}
            >
              {o.texto}
            </Text>
            {o.contador ? (
              <View style={[styles.contador, activo && styles.contadorActivo]}>
                <Text style={[styles.contadorTexto, activo && styles.contadorTextoActivo]}>
                  {o.contador}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const PADDING = 4;
const ALTO = 40;
const ALTO_COMPACTO = 34;

const styles = StyleSheet.create({
  caja: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: PADDING,
    marginBottom: spacing.md,
  },
  pastilla: {
    position: 'absolute',
    top: PADDING,
    left: PADDING,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
  },
  segmento: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 4,
  },
  texto: {
    ...typography.small,
    color: colors.textMuted,
    fontFamily: fonts.semiBold,
    flexShrink: 1,
  },
  textoCompacto: { fontSize: 12 },
  textoActivo: { color: colors.onPrimary },
  contador: {
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contadorActivo: { backgroundColor: 'rgba(0,0,0,0.22)' },
  contadorTexto: { fontSize: 10, color: colors.textMuted, fontFamily: fonts.semiBold },
  contadorTextoActivo: { color: colors.onPrimary },
});
