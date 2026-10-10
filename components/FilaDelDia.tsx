import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { ProgressBar } from './ProgressBar';
import { colors, fonts, spacing, typography } from '../lib/theme';

/**
 * Una fila de la tarjeta de la semana del inicio: pasos, calorías.
 *
 * La cifra del día, contra qué se mide y una barra fina. Las dos filas tienen
 * que verse iguales —es la gracia de tenerlas juntas: se leen como una lista—,
 * así que la forma vive aquí y no copiada en cada una.
 */
export function FilaDelDia({
  icono,
  etiqueta,
  valor,
  de,
  progreso,
  tono = 'normal',
  accion,
  onPress,
}: {
  icono: React.ComponentProps<typeof Ionicons>['name'];
  etiqueta: string;
  /** La cifra, ya escrita ("8.500"). Sin ella sale `accion`. */
  valor?: string;
  /** Contra qué se mide, ya escrito ("10.000"). */
  de?: string;
  /** De 0 a 1. Sin él no hay barra. */
  progreso?: number;
  /** 'cumplido' en oro claro; 'pasado' en rojo (calorías de más). */
  tono?: 'normal' | 'cumplido' | 'pasado';
  /** Lo que se dice cuando aún no hay cifra ("Conectar"). */
  accion?: string;
  onPress?: () => void;
}) {
  const color =
    tono === 'pasado' ? colors.danger : tono === 'cumplido' ? colors.primaryBright : colors.text;
  return (
    <Pressable onPress={onPress} style={styles.fila}>
      <View style={styles.arriba}>
        <Ionicons name={icono} size={17} color={colors.textMuted} />
        <Text style={styles.etiqueta}>{etiqueta}</Text>
        {valor === undefined ? (
          <Text style={styles.accion}>{accion}</Text>
        ) : (
          <Text style={[styles.valor, { color }]}>
            {valor}
            {de ? <Text style={styles.de}>{` / ${de}`}</Text> : null}
          </Text>
        )}
        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
      </View>
      {progreso === undefined ? null : <ProgressBar progress={progreso} height={4} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Dentro de la tarjeta de la semana: sin caja propia, separada por una raya.
  fila: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  arriba: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  etiqueta: { ...typography.body, color: colors.textMuted, flex: 1 },
  valor: { ...typography.body, fontFamily: fonts.semiBold },
  de: { ...typography.small, color: colors.textFaint, fontFamily: fonts.body },
  accion: { ...typography.small, color: colors.primary, fontFamily: fonts.semiBold },
});
