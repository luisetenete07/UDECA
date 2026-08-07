import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../lib/theme';

/**
 * El panel que sube desde abajo, y solo hay uno.
 *
 * Estaba copiado en cuatro sitios —ciclo, plan, semana y tarea— con el mismo
 * fondo, la misma asa, el mismo radio y el mismo ancho máximo. Lo único que
 * había divergido era la altura máxima: 88 %, 90 % y 92 %, tres números
 * distintos para la misma decisión, elegidos a ojo y en días distintos. Aquí es
 * 92 %: deja ver una franja del fondo, que es lo que hace entender que esto se
 * cierra sin salir de donde estabas.
 *
 * El texto de fuera se cierra al tocarlo. No es un adorno: en un panel alto y
 * lleno de campos, la vía de escape que la gente busca primero es tocar fuera,
 * no encontrar una equis.
 */
export function Sheet({
  visible = true,
  onClose,
  titulo,
  descripcion,
  children,
}: {
  /** Los paneles que se montan y desmontan pueden dejarlo por omisión. */
  visible?: boolean;
  onClose: () => void;
  titulo: string;
  /** Una frase de contexto bajo el título, cuando hace falta. */
  descripcion?: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.fondo}>
        <Pressable style={styles.fondoTap} onPress={onClose} />
        <View style={styles.panel}>
          <View style={styles.asa} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.titulo}>{titulo}</Text>
            {descripcion ? <Text style={styles.descripcion}>{descripcion}</Text> : null}
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  fondoTap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  panel: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
    maxHeight: '92%',
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  asa: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  titulo: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  descripcion: {
    ...typography.small,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
});
