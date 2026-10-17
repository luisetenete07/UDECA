import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { CardButton } from './CardButton';
import { diaLargo, horaCorta } from '../lib/fechas';
import { frase } from '../lib/idioma';
import { delMes, loQueTiene, proximas, type AjustesLlamadas, type Llamada } from '../lib/llamadas';
import { colors, fonts, spacing, typography } from '../lib/theme';

/**
 * La llamada con el entrenador, en el inicio del alumno.
 *
 * Con una reservada, dice cuándo (es lo que hay que recordar). Sin ninguna,
 * cuántas le quedan este mes y lleva a reservar. Si el entrenador no tiene las
 * llamadas abiertas o su plan no las incluye, no sale: una tarjeta para decir
 * "no puedes" ocupa sitio y no ayuda.
 */
export function TarjetaDeLlamada({
  ajustes,
  mias,
  planId,
  onPress,
}: {
  ajustes: AjustesLlamadas;
  mias: Llamada[];
  planId?: string | null;
  onPress: () => void;
}) {
  const siguiente = proximas(mias)[0];
  const suyo = loQueTiene(ajustes, planId);
  if (!siguiente && (!ajustes.activas || suyo.llamadasAlMes <= 0)) return null;
  const quedan = Math.max(0, suyo.llamadasAlMes - delMes(mias, Date.now()));
  return (
    <CardButton onPress={onPress} style={styles.tarjeta}>
      <View style={styles.icono}>
        <Ionicons name={siguiente ? 'call' : 'call-outline'} size={18} color={colors.success} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.titulo}>{siguiente ? 'Tu próxima llamada' : 'Llamada con tu entrenador'}</Text>
        <Text style={styles.detalle} numberOfLines={1}>
          {siguiente
            ? `${diaLargo(siguiente.inicio)} · ${horaCorta(siguiente.inicio)}`
            : quedan === 1
              ? 'Te queda 1 este mes · Reservar'
              : quedan > 0
                ? frase`Te quedan ${quedan} este mes · Reservar`
                : 'Ya has usado las de este mes'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </CardButton>
  );
}

const styles = StyleSheet.create({
  tarjeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  icono: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.successMuted,
  },
  titulo: { ...typography.body, color: colors.text, fontFamily: fonts.semiBold },
  detalle: { ...typography.small, color: colors.textMuted, marginTop: 2 },
});
