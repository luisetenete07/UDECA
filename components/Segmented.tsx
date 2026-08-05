import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { PressableScale } from './PressableScale';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * Elegir entre dos o tres cosas que se excluyen.
 *
 * Estaba escrito cinco veces —las pestañas de Progreso, el conmutador de
 * músculos, el ámbito de los ingresos, el método del plan del alumno y el del
 * editor de rutinas— y ninguno medía igual que otro: el hueco entre botones era
 * 2, 4 o `spacing.xs`; el relleno del carril, 3, 4 o `spacing.xs`; unos
 * llevaban borde y otros no. Cinco maneras de pintar el mismo gesto en la misma
 * app, que es de lo que más delata que algo se ha ido haciendo a trozos.
 *
 * NO SIRVE PARA MÁS DE TRES. Con cuatro opciones los rótulos se parten o se
 * recortan, y un control donde no puedes leer lo que eliges deja de ser un
 * control: eso es una lista, o un desplegable, o unas pastillas que ruedan.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  style,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.track, style]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <PressableScale
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.btn, on && styles.btnOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.text, on && styles.textOn]} numberOfLines={1}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  btnOn: { backgroundColor: colors.primary },
  text: { ...typography.small, color: colors.textMuted, fontFamily: fonts.semiBold },
  textOn: { color: colors.onPrimary },
});
