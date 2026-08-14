import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from './Avatar';
import { FadeIn } from './FadeIn';
import { colors, fonts, radius, spacing, tabularNums, typography } from '../lib/theme';

/**
 * El podio: los tres primeros, por tamaño y no por medallas.
 *
 * Una clasificación se lee entera en el primer segundo o no se lee: quién va
 * primero, y dónde estoy yo. En una lista de tarjetas iguales eso hay que
 * buscarlo, y buscar es exactamente lo que nadie hace.
 *
 * Las medallas de colores se van. Eran los únicos tres colores saturados de
 * toda la app —oro, plata y bronce de emoji— y abarataban la pantalla entera.
 * Aquí el primero es más grande y está en el centro, que es como se lee un
 * podio de verdad sin que nadie te explique nada.
 */

export interface PuestoPodio {
  uid: string;
  name: string;
  photoURL?: string | null;
  /** La cifra por la que se compite. */
  valor: number;
  /** "marcas", "entrenos". */
  unidad: string;
}

/** Orden en pantalla: segundo, primero, tercero. Como un podio. */
const COLOCACION = [1, 0, 2];

export function Podium({
  puestos,
  yo,
  icono = 'trending-up',
}: {
  puestos: PuestoPodio[];
  yo?: string;
  /** El icono de la cifra. Por omisión, el de mejorar. */
  icono?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  if (puestos.length === 0) return null;

  return (
    <View style={styles.fila}>
      {COLOCACION.map((idx, orden) => {
        const p = puestos[idx];
        if (!p) return <View key={`hueco-${idx}`} style={styles.columna} />;
        const primero = idx === 0;
        const esYo = p.uid === yo;
        return (
          <FadeIn key={p.uid} delay={80 * orden} style={styles.columna}>
            <View style={styles.persona}>
              <View
                style={[
                  styles.aro,
                  primero && styles.aroPrimero,
                  esYo && styles.aroYo,
                ]}
              >
                <Avatar name={p.name} photoURL={p.photoURL} size={primero ? 60 : 46} />
              </View>
              <Text style={[styles.nombre, primero && styles.nombrePrimero]} numberOfLines={1}>
                {p.name.split(' ')[0]}
              </Text>
              <View style={styles.cifraFila}>
                <Ionicons
                  name={icono}
                  size={primero ? 13 : 11}
                  color={primero ? colors.primaryBright : colors.primary}
                />
                <Text style={[styles.cifra, primero && styles.cifraPrimero]}>
                  {p.valor}
                </Text>
              </View>
              <Text style={styles.unidad}>{p.unidad}</Text>
            </View>

            {/* El escalón. Su altura es el puesto: no hace falta leer nada. */}
            <View
              style={[
                styles.escalon,
                { height: primero ? 54 : idx === 1 ? 38 : 28 },
                primero && styles.escalonPrimero,
              ]}
            >
              <Text style={[styles.puesto, primero && styles.puestoPrimero]}>{idx + 1}</Text>
            </View>
          </FadeIn>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  columna: { flex: 1, alignItems: 'center' },
  persona: { alignItems: 'center', gap: 3, marginBottom: spacing.sm },
  aro: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 3,
  },
  aroPrimero: { borderColor: colors.primaryBright, borderWidth: 2.5 },
  aroYo: { borderColor: colors.primary },
  nombre: { ...typography.small, color: colors.textMuted, fontFamily: fonts.medium, maxWidth: 92 },
  nombrePrimero: { color: colors.text, fontFamily: fonts.semiBold },
  cifraFila: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cifra: {
    ...typography.body,
    color: colors.text,
    fontFamily: fonts.semiBold,
    ...tabularNums,
  },
  cifraPrimero: { fontSize: 19, color: colors.primaryBright, fontFamily: fonts.display },
  unidad: { fontSize: 10, color: colors.textFaint, fontFamily: fonts.medium },
  escalon: {
    width: '100%',
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  escalonPrimero: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.hairlineFaint,
  },
  puesto: {
    fontSize: 15,
    fontFamily: fonts.display,
    color: colors.textFaint,
    ...tabularNums,
  },
  puestoPrimero: { fontSize: 19, color: colors.primaryBright },
});
