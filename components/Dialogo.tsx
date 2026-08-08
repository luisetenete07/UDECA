import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { colors, radius, spacing, typography } from '../lib/theme';

/**
 * La ventana de "¿seguro?", centrada, y solo hay una.
 *
 * `confirmar()` (lib/confirmar.ts) resuelve las confirmaciones pequeñas con el
 * aviso del sistema. Esta es para lo grande: borrar un curso con sus lecciones,
 * un ejercicio que está dentro de las rutinas de medio grupo. Ahí hace falta
 * CONTAR qué se lleva por delante, y un `window.confirm` de una línea no cuenta
 * nada.
 *
 * El marco estaba copiado en seis pantallas y usado once veces. Igual en todas,
 * lo cual suena a que daba igual dejarlo así — hasta que se toca una y las
 * demás se quedan atrás.
 *
 * El botón destructivo va primero y el de cancelar debajo, no al lado: dos
 * botones en fila se pulsan por posición y no por texto, y aquí equivocarse
 * cuesta datos. Separados verticalmente, el pulgar tiene que decidir.
 */
export function Dialogo({
  visible,
  onClose,
  icono,
  titulo,
  texto,
  children,
  accion,
  onAccion,
  cargando = false,
  desactivado = false,
  cancelar = 'Cancelar',
}: {
  visible: boolean;
  onClose: () => void;
  /** Icono en rojo sobre el título, cuando lo que se va a hacer es destructivo. */
  icono?: React.ComponentProps<typeof Ionicons>['name'];
  titulo: string;
  /** Qué pasa exactamente si se confirma. Concreto, no "esta acción...". */
  texto?: React.ReactNode;
  /** Lo que haga falta entre el texto y los botones (un campo, una lista). */
  children?: React.ReactNode;
  /** Texto del botón que hace la cosa. Sin él, la ventana es solo informativa. */
  accion?: string;
  onAccion?: () => void;
  cargando?: boolean;
  desactivado?: boolean;
  cancelar?: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.fondo} onPress={onClose}>
        {/* La tarjeta se come el toque: tocar dentro no cierra. */}
        <Pressable style={styles.tarjeta} onPress={() => {}}>
          {icono ? (
            <View style={styles.icono}>
              <Ionicons name={icono} size={24} color={colors.danger} />
            </View>
          ) : null}
          <Text style={styles.titulo}>{titulo}</Text>
          {typeof texto === 'string' ? <Text style={styles.texto}>{texto}</Text> : texto}
          {children}
          {accion && onAccion ? (
            <Button
              title={accion}
              variant="danger"
              onPress={onAccion}
              loading={cargando}
              disabled={desactivado}
              style={{ marginTop: spacing.md }}
            />
          ) : null}
          <Button
            title={cancelar}
            variant="ghost"
            onPress={onClose}
            style={{ marginTop: accion ? spacing.xs : spacing.md }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.scrim,
    padding: spacing.lg,
  },
  tarjeta: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 420,
  },
  icono: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.dangerMuted,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  titulo: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  texto: { ...typography.small, color: colors.textMuted, lineHeight: 19 },
});
