import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { Card } from './Card';
import { Button } from './Button';
import { diaLargo, horaCorta } from '../lib/fechas';
import { frase, t } from '../lib/idioma';
import { esHoraDeEntrar, faltaPara, finDe, type Falta, type LlamadaGrupal } from '../lib/llamadaGrupal';
import { colors, fonts, radius, spacing, tabularNums, typography } from '../lib/theme';

/** "Faltan 6 días", "Mañana", "Empieza en 20 min", "En directo". */
export function textoDeFalta(f: Falta): string {
  switch (f.cuando) {
    case 'directo':
      return t('En directo');
    case 'minutos':
      return frase`Empieza en ${f.n} min`;
    case 'hoy':
      return t('Hoy');
    case 'manana':
      return t('Mañana');
    case 'dias':
      return frase`Faltan ${f.n} días`;
  }
}

/**
 * LA LLAMADA GRUPAL, FIJADA EN EL INICIO DEL ALUMNO (lib/llamadaGrupal.ts).
 *
 * Sale desde los días antes que eligió su entrenador hasta que termina. Dice
 * qué es, cuándo y cuánto falta, y lleva el botón para entrar: un cuarto de
 * hora antes pasa a ser el botón principal, que es cuando se busca.
 */
export function LlamadaGrupalFijada({ llamada: l, ahora = Date.now() }: { llamada: LlamadaGrupal; ahora?: number }) {
  const falta = faltaPara(l, ahora);
  const ya = esHoraDeEntrar(l, ahora);
  const cerca = falta.cuando === 'directo' || falta.cuando === 'minutos' || falta.cuando === 'hoy';
  return (
    <Card accent style={styles.tarjeta}>
      <View style={styles.cabecera}>
        <View style={styles.icono}>
          <Ionicons name="people" size={18} color={colors.primaryBright} />
        </View>
        <View style={styles.etiquetaFila}>
          <Ionicons name="pin" size={12} color={colors.textMuted} />
          <Text style={styles.etiqueta}>Llamada grupal</Text>
        </View>
        <View style={[styles.falta, cerca && styles.faltaCerca]}>
          {falta.cuando === 'directo' ? <View style={styles.enDirecto} /> : null}
          <Text style={[styles.faltaTexto, cerca && styles.faltaTextoCerca]}>{textoDeFalta(falta)}</Text>
        </View>
      </View>
      <Text style={styles.titulo}>{l.titulo}</Text>
      <Text style={styles.cuando}>{`${diaLargo(l.inicio)} · ${horaCorta(l.inicio)} – ${horaCorta(finDe(l))}`}</Text>
      {l.nota ? (
        <Text style={styles.nota} numberOfLines={4}>
          {l.nota}
        </Text>
      ) : null}
      {l.enlace ? (
        <Button
          title="Entrar a la llamada"
          variant={ya ? 'primary' : 'secondary'}
          compacto
          onPress={() => Linking.openURL(l.enlace!).catch(() => {})}
          style={styles.entrar}
        />
      ) : (
        <Text style={styles.sinEnlace}>Tu entrenador os dirá por dónde se hace.</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  tarjeta: { marginBottom: spacing.md },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icono: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryMuted,
  },
  etiquetaFila: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  etiqueta: {
    ...typography.small,
    color: colors.textMuted,
    fontFamily: fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 11,
  },
  falta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  faltaCerca: { backgroundColor: colors.primaryMuted },
  faltaTexto: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold, fontSize: 12, ...tabularNums },
  faltaTextoCerca: { color: colors.primaryBright },
  enDirecto: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger },
  titulo: { ...typography.h3, color: colors.text, marginTop: spacing.sm },
  cuando: { ...typography.small, color: colors.primaryBright, fontFamily: fonts.semiBold, marginTop: 2, ...tabularNums },
  nota: { ...typography.small, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 19 },
  entrar: { marginTop: spacing.md },
  sinEnlace: { ...typography.small, color: colors.textFaint, marginTop: spacing.sm },
});
