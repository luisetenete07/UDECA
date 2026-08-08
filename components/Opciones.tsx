import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * La fila de opciones que se reparte el ancho: Normal / Lastrado / Goma,
 * Repeticiones / Tiempo, el agarre, la categoría del ejercicio.
 *
 * Estaba escrita a mano doce veces entre los dos editores de rutina —el del
 * coach y el del atleta— y las medidas ya no coincidían: el mismo botón tenía
 * 7 px de alto en una pantalla y 10 en la otra, y el radio era `sm` aquí y `md`
 * allí. Se editan las dos rutinas con el mismo gesto y a los mismos campos, así
 * que no hay ninguna razón para que se vean distintas.
 *
 * No es `Segmented`: aquel es un selector de pestañas con su pastilla
 * deslizante y su hueco debajo, para cambiar de VISTA. Esto va dentro de la
 * ficha de un ejercicio, apretado entre campos, y varias de estas filas se
 * pueden dejar EN BLANCO (el agarre, por ejemplo, casi nunca se especifica).
 */

export interface Opcion<T extends string> {
  valor: T;
  texto: string;
}

export function Opciones<T extends string>({
  opciones,
  valor,
  onChange,
  desmarcable = false,
  envuelve = false,
}: {
  opciones: Opcion<T>[];
  /** Sin valor, ninguna aparece elegida. */
  valor?: T;
  /** Con `desmarcable`, volver a tocar la elegida devuelve `undefined`. */
  onChange: (v: T | undefined) => void;
  desmarcable?: boolean;
  /**
   * Se parte en varias líneas en vez de repartir el ancho. Para listas largas
   * —las categorías musculares— donde repartir a la fuerza parte los nombres.
   */
  envuelve?: boolean;
}) {
  return (
    <View style={envuelve ? styles.filaEnvuelta : styles.fila}>
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            onPress={() => onChange(activo && desmarcable ? undefined : o.valor)}
            style={[
              styles.opcion,
              envuelve ? styles.opcionSuelta : styles.opcionRepartida,
              activo && styles.activa,
            ]}
            hitSlop={2}
            accessibilityRole="button"
            accessibilityState={{ selected: activo }}
          >
            <Text style={[styles.texto, activo && styles.textoActivo]} numberOfLines={1}>
              {o.texto}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', gap: spacing.xs },
  filaEnvuelta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  opcion: {
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  opcionRepartida: { flex: 1 },
  opcionSuelta: { paddingHorizontal: spacing.sm + 2 },
  activa: { backgroundColor: colors.primary, borderColor: colors.primary },
  texto: {
    ...typography.small,
    color: colors.textMuted,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  textoActivo: { color: colors.onPrimary },
});
