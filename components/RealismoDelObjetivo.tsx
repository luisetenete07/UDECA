import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Texto';
import { t } from '../lib/idioma';
import type { PlazoDeObjetivo } from '../lib/objetivos';
import { colors, fonts } from '../lib/theme';

/**
 * El color de cada grado de realismo, como un semáforo: verde lo seguro, ámbar
 * lo difícil, rojo lo casi imposible. Con el beige de la marca, el sueño
 * parecía un objetivo desactivado.
 */
export const TONO_DEL_REALISMO: Record<PlazoDeObjetivo['realismo'], string> = {
  3: colors.success,
  2: colors.warning,
  1: colors.danger,
};

/**
 * Lo realista que es un plazo: tres barras como las de la cobertura, más
 * llenas cuanto más seguro, y al lado "Realista 3/3".
 *
 * Es el mismo en el inicio del alumno, en su perfil y en la ficha que ve Luis:
 * un objetivo no puede ser 3/3 en una pantalla y otra cosa en la de al lado.
 */
export function Realismo({ plazo }: { plazo: PlazoDeObjetivo }) {
  const tono = TONO_DEL_REALISMO[plazo.realismo];
  return (
    <View style={styles.realismo} accessible accessibilityLabel={t(plazo.comoDeRealista)}>
      <View style={styles.barras}>
        {[1, 2, 3].map((n) => (
          <View
            key={n}
            style={[
              styles.barra,
              { height: 4 + n * 3, backgroundColor: n <= plazo.realismo ? tono : colors.borderStrong },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.texto, { color: tono }]} numberOfLines={1}>
        {plazo.comoDeRealista}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  realismo: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 13 },
  barra: { width: 4, borderRadius: 1 },
  texto: { fontSize: 11, lineHeight: 14, fontFamily: fonts.semiBold },
});
