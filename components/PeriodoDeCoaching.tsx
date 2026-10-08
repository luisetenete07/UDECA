import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { frase } from '../lib/idioma';
import { diaMes } from '../lib/fechas';
import type { Coaching } from '../lib/coaching';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * "Quedan 12 días", "Acaba hoy", "Terminó hace 3 días"...
 *
 * Va aquí, con la traducción, y no en lib/coaching.ts: aquel es puro (lo
 * ejecuta el guardián en Node) y `frase` arrastra el idioma de la app.
 */
export function textoDelPeriodo(c: Coaching): string {
  if (c.dias === null) return frase`Sin fecha de fin`;
  if (c.dias === 0) return frase`Acaba hoy`;
  if (c.dias === 1) return frase`Acaba mañana`;
  if (c.dias > 1) return frase`Quedan ${c.dias} días`;
  if (c.estado === 'pausado') return frase`Terminó hace ${-c.dias} días · app en pausa`;
  if (c.dias === -1) return frase`Terminó ayer`;
  return frase`Terminó hace ${-c.dias} días`;
}

/** El color que lleva cada estado: el mismo en la ficha, la lista y el panel. */
export function colorDelPeriodo(c: Coaching): string {
  switch (c.estado) {
    case 'activo':
      return colors.success;
    case 'acaba':
    case 'terminado':
      return colors.warning;
    case 'pausado':
      return colors.danger;
    default:
      return colors.textMuted;
  }
}

/**
 * El periodo, grande: la fecha de fin y lo que queda. Es lo primero que se lee
 * de la relación con un alumno, así que va en una caja propia y no como una
 * línea más de un formulario.
 */
export function PeriodoDeCoaching({ coaching }: { coaching: Coaching }) {
  const color = colorDelPeriodo(coaching);
  return (
    <View style={[styles.caja, { borderColor: color }]}>
      <Text style={styles.fecha}>
        {coaching.hasta ? frase`Hasta el ${diaMes(coaching.hasta)}` : frase`Sin fecha de fin`}
      </Text>
      {coaching.hasta ? (
        <Text style={[styles.dias, { color }]}>{textoDelPeriodo(coaching)}</Text>
      ) : (
        <Text style={styles.dias}>Entra siempre, sin pausa.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  caja: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.md,
  },
  fecha: { ...typography.h2, color: colors.text },
  dias: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold, marginTop: 2 },
});
