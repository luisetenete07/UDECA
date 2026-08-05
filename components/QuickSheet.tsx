import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { colors, fonts, radius, spacing, typography } from '../lib/theme';

/**
 * Acciones rápidas: se mantiene pulsado y sale lo que se puede hacer.
 *
 * Llegar a la rutina de un alumno costaba abrir su ficha, bajar entre once
 * tarjetas y pulsar. Tres o cuatro toques para algo que se hace veinte veces al
 * día. Aquí son dos, y sin cambiar de pantalla si al final no era eso.
 *
 * El menú se abre DONDE ya estás mirando, que es la diferencia entre una
 * herramienta y un laberinto: quien mantiene pulsado sobre un alumno ya sabe de
 * quién habla, así que la lista no repite el contexto, solo ofrece salidas.
 */

export interface AccionRapida {
  icono: React.ComponentProps<typeof Ionicons>['name'];
  texto: string;
  onPress: () => void;
  /** Acción destructiva o delicada: se pinta aparte. */
  peligro?: boolean;
}

export function QuickSheet({
  visible,
  titulo,
  subtitulo,
  acciones,
  onClose,
}: {
  visible: boolean;
  titulo: string;
  subtitulo?: string;
  acciones: AccionRapida[];
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.titulo} numberOfLines={1}>
            {titulo}
          </Text>
          {subtitulo ? <Text style={styles.subtitulo}>{subtitulo}</Text> : null}

          <View style={styles.lista}>
            {acciones.map((a) => (
              <PressableScale
                key={a.texto}
                haptic
                style={styles.accion}
                onPress={() => {
                  onClose();
                  a.onPress();
                }}
              >
                <Ionicons
                  name={a.icono}
                  size={19}
                  color={a.peligro ? colors.danger : colors.primary}
                />
                <Text style={[styles.accionTexto, a.peligro && { color: colors.danger }]}>
                  {a.texto}
                </Text>
                <Ionicons name="chevron-forward" size={15} color={colors.textFaint} />
              </PressableScale>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  titulo: { ...typography.h2, color: colors.text },
  subtitulo: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  lista: { marginTop: spacing.md },
  accion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  accionTexto: { ...typography.body, color: colors.text, flex: 1, fontFamily: fonts.medium },
});
