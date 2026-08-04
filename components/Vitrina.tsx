import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { CountUp } from './CountUp';
import { colors, fonts, spacing, tabularNums, typography } from '../lib/theme';

/**
 * Cifras en vitrina: grandes, sin caja y separadas por un filo.
 *
 * Es el gesto que el rediseño repite cada vez que unos números son el contenido
 * de un sitio y no un adorno — el perfil, el resumen del entreno, el resumen de
 * la comunidad—. Antes eran cuadraditos iguales con su icono, su borde y su
 * fondo, y tres o cuatro números del mismo tamaño no son tres o cuatro datos:
 * son ninguno, porque no hay dónde mirar primero.
 *
 * Sin bordes, sin fondo y sin iconos: cuando la cifra es lo importante, todo lo
 * que la rodea le quita. Y suben desde cero al entrar, que es medio segundo de
 * atención sobre lo que la pantalla vino a decir.
 *
 * Tres es el máximo por una razón de ancho, no de gusto: a `hero` (34 px) una
 * cifra de cuatro dígitos ya ocupa casi un tercio de un móvil, así que la cuarta
 * columna obligaría a encoger la letra y a perder justo lo que se busca.
 */
export interface CifraVitrina {
  valor: number;
  etiqueta: string;
  /** Para cifras que no cuentan (un texto ya formateado, un guion). */
  texto?: string;
}

export function Vitrina({
  cifras,
  style,
}: {
  cifras: CifraVitrina[];
  style?: StyleProp<ViewStyle>;
}) {
  if (cifras.length === 0) return null;
  return (
    <View style={[styles.vitrina, style]}>
      {cifras.slice(0, 3).map((c, i) => (
        <React.Fragment key={c.etiqueta}>
          {i > 0 ? <View style={styles.separador} /> : null}
          <View style={styles.item}>
            {c.texto !== undefined ? (
              <Text style={styles.cifra}>{c.texto}</Text>
            ) : (
              <CountUp value={c.valor} style={styles.cifra} />
            )}
            <Text style={styles.etiqueta} numberOfLines={2}>
              {c.etiqueta}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  vitrina: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  item: { flex: 1, alignItems: 'center', gap: 2, minWidth: 0 },
  separador: { width: 1, height: 34, backgroundColor: colors.border },
  cifra: {
    ...typography.hero,
    // Los dígitos de Sora son de ancho proporcional: sin cifras tabulares el
    // número se ensancha y se estrecha mientras cuenta.
    ...tabularNums,
    color: colors.text,
  },
  etiqueta: {
    fontSize: 11,
    color: colors.textFaint,
    fontFamily: fonts.semiBold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
