import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * Lista vertical de opciones con su punto de radio.
 *
 * Es lo que hay que usar cuando las opciones no caben en una fila sin partirse
 * —"Reps por lado", "Aguante en segundos"— y por eso no se resuelve con
 * `Opciones`: forzarlas a repartirse el ancho recorta los nombres, y un nombre
 * recortado en un selector es peor que ocupar tres líneas.
 *
 * La elegida se marca con un tinte suave y no con relleno dorado, al revés que
 * las pastillas: aquí el punto de radio ya dice cuál está elegida, y rellenar
 * una fila entera de dorado dentro de un formulario grita más de lo que informa.
 *
 * Estaba escrita igual en los dos editores de ejercicio (el del coach y la
 * plantilla del admin) con los estilos llamados de dos maneras distintas.
 */
export function ListaRadio<T extends string>({
  opciones,
  valor,
  onChange,
}: {
  opciones: { valor: T; texto: string }[];
  valor?: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.lista}>
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            onPress={() => onChange(o.valor)}
            style={[styles.opcion, activo && styles.activa]}
            accessibilityRole="radio"
            accessibilityState={{ selected: activo }}
          >
            <Ionicons
              name={activo ? 'radio-button-on' : 'radio-button-off'}
              size={18}
              color={activo ? colors.primary : colors.textFaint}
            />
            <Text style={[styles.texto, activo && styles.textoActivo]}>{o.texto}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  lista: { gap: spacing.xs, marginBottom: spacing.md },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  activa: { borderColor: colors.hairline, backgroundColor: colors.primaryMuted },
  texto: { ...typography.body, color: colors.textMuted, flex: 1 },
  textoActivo: { color: colors.text, fontFamily: fonts.semiBold },
});
