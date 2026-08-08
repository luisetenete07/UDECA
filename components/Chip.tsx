import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * La pastilla que se enciende al elegirla, y una sola forma de encenderla.
 *
 * Se usa en media app —filtros de ejercicios, grupos musculares, nivel del
 * alumno, ejercicios de una semana— y estaba escrita seis veces. El problema no
 * era la repetición sino que el estado ELEGIDO había salido de dos maneras
 * distintas: en cuatro sitios se rellena de dorado con la letra oscura, y en
 * otros dos se queda con un tinte suave y la letra dorada. Son dos señales
 * distintas para lo mismo, y quien usa la app varias veces al día aprende a
 * leer una de las dos y duda con la otra.
 *
 * Gana la de relleno: se ve de un vistazo cuántos filtros hay puestos sin tener
 * que fijarse, que es justo lo que se le pide a un filtro.
 */
export function Chip({
  texto,
  activo = false,
  onPress,
  icono,
  punto,
  /** Tono discreto para acciones que no son "elegir" (renombrar, editar). */
  suave = false,
}: {
  texto: string;
  activo?: boolean;
  onPress?: () => void;
  icono?: React.ComponentProps<typeof Ionicons>['name'];
  /** Punto de color a la izquierda: el estado de pago, el tono de un aviso. */
  punto?: string;
  suave?: boolean;
}) {
  const colorIcono = suave ? colors.primary : activo ? colors.onPrimary : colors.textMuted;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, activo && styles.activo, suave && styles.suave]}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
    >
      {punto ? <View style={[styles.punto, { backgroundColor: punto }]} /> : null}
      {icono ? <Ionicons name={icono} size={13} color={colorIcono} /> : null}
      <Text style={[styles.texto, activo && styles.textoActivo, suave && styles.textoSuave]}>
        {texto}
      </Text>
    </Pressable>
  );
}

/**
 * La fila de pastillas. Con `scroll` se desliza en horizontal (para listas
 * largas de filtros); sin él, se parte en varias líneas.
 */
export function ChipRow({
  children,
  scroll = false,
}: {
  children: React.ReactNode;
  scroll?: boolean;
}) {
  if (scroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.fila}
        style={styles.filaScroll}
      >
        {children}
      </ScrollView>
    );
  }
  return <View style={[styles.fila, styles.filaEnvuelta]}>{children}</View>;
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  punto: { width: 8, height: 8, borderRadius: 4 },
  activo: { backgroundColor: colors.primary, borderColor: colors.primary },
  suave: { backgroundColor: colors.primaryMuted, borderColor: colors.hairline },
  texto: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  textoActivo: { color: colors.onPrimary },
  textoSuave: { color: colors.primary },
  fila: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  filaEnvuelta: { flexWrap: 'wrap' },
  filaScroll: { marginBottom: spacing.md },
});
