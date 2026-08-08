import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing, typography } from '../lib/theme';
import { WEEKDAY_LABELS } from '../lib/types';

/**
 * L M X J V S D: a qué día de la semana va este día de la rutina.
 *
 * Estaba escrito igual en los dos editores —el del coach y el del atleta—, con
 * la única diferencia de cómo se llamaban los estilos. Los dos ya alternaban al
 * volver a tocar el día elegido, así que aquí eso es el comportamiento y no un
 * detalle que cada pantalla decida por su cuenta.
 *
 * Círculos y no pastillas alargadas a propósito: siete elementos de una letra
 * caben en una fila de móvil sin apretarse, y el ojo lee la semana entera de un
 * vistazo en vez de leer siete palabras.
 */
export function DiasSemana({
  valor,
  onChange,
}: {
  /** 0 = lunes. `undefined` = este día no está atado al calendario. */
  valor?: number;
  /** Devuelve `undefined` al tocar el día que ya estaba elegido. */
  onChange: (dia: number | undefined) => void;
}) {
  return (
    <View style={styles.fila}>
      {WEEKDAY_LABELS.map((letra, i) => {
        const activo = valor === i;
        return (
          <Pressable
            key={letra}
            onPress={() => onChange(activo ? undefined : i)}
            style={[styles.dia, activo && styles.activo]}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityState={{ selected: activo }}
          >
            <Text style={[styles.texto, activo && styles.textoActivo]}>{letra}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  dia: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  activo: { backgroundColor: colors.primary, borderColor: colors.primary },
  texto: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  textoActivo: { color: colors.onPrimary },
});
