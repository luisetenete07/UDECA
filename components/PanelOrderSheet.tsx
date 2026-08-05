import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DragList } from './DragList';
import { Sheet } from './Sheet';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * Reordenar los bloques del panel, en una lista corta.
 *
 * La tentación era poner un asa en cada tarjeta y arrastrarlas donde están. No
 * funciona: las tarjetas del panel miden cuatrocientos píxeles, así que mover
 * una tres puestos abajo obliga a arrastrar por media pantalla mientras el
 * contenido se desplaza solo, y no se ve dónde va a caer. Aquí cada bloque es
 * una fila de su altura mínima: los seis caben a la vez y el gesto dura lo que
 * dura mirarlos.
 *
 * Y no lleva asa por fila: en una lista donde no hay nada más que tocar, el asa
 * sobra. La fila entera es el asa.
 */
export interface BloqueOrdenable {
  id: string;
  icono: React.ComponentProps<typeof Ionicons>['name'];
  titulo: string;
}

export function PanelOrderSheet({
  visible,
  onClose,
  bloques,
  onReorder,
  onRestaurar,
}: {
  visible: boolean;
  onClose: () => void;
  /** Ya en el orden actual. */
  bloques: BloqueOrdenable[];
  onReorder: (desde: number, hasta: number) => void;
  onRestaurar: () => void;
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Ordenar el panel"
      subtitle="Mantén pulsado un bloque y muévelo. Se guarda en este dispositivo."
    >
      <DragList
        items={bloques}
        keyOf={(b) => b.id}
        onReorder={onReorder}
        gap={spacing.xs}
        renderItem={(b, _i, arrastrando) => (
          <View style={[styles.fila, arrastrando && styles.filaArrastrando]}>
            <Ionicons name={b.icono} size={17} color={colors.primary} />
            <Text style={styles.titulo} numberOfLines={1}>
              {b.titulo}
            </Text>
            <Ionicons name="reorder-three" size={20} color={colors.textFaint} />
          </View>
        )}
      />

      <Text style={styles.pie} onPress={onRestaurar}>
        Volver al orden original
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  filaArrastrando: { borderColor: colors.hairline },
  titulo: { ...typography.body, color: colors.text, flex: 1, fontFamily: fonts.medium },
  pie: {
    ...typography.small,
    color: colors.textFaint,
    textAlign: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
    textDecorationLine: 'underline',
  },
});
