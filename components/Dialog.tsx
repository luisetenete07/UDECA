import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../lib/theme';

/**
 * El diálogo del centro: preguntar antes de algo que no se deshace.
 *
 * Es el otro modal de la app, distinto de la hoja que sube desde abajo
 * (`Sheet.tsx`). La hoja OFRECE —elige un día, mueve un ejercicio— y por eso
 * ocupa el borde inferior, donde llega el pulgar. El diálogo INTERRUMPE: sale
 * en el centro, tapa lo de detrás y no continúa hasta que contestas. Confundir
 * los dos es lo que hace que una app pregunte cosas donde debería ofrecerlas.
 *
 * Estaba escrito ocho veces en siete pantallas, con el velo y la tarjeta
 * copiados byte a byte en tres de ellas.
 *
 * TOCAR FUERA CANCELA. Aquí sí es seguro —y en varias pantallas no funcionaba,
 * porque el velo era una `View` y no recogía el toque—: en un diálogo de
 * confirmar, salirse SIN hacer nada es justo lo que quiere quien se ha
 * arrepentido. La zona va detrás de la tarjeta, no envolviéndola, para que
 * tocar el texto de la pregunta no cancele.
 */
export function Dialog({
  visible,
  onClose,
  icon,
  tone = 'primary',
  title,
  children,
  /** `center` para avisos; `stretch` cuando dentro hay campos o listas. */
  align = 'center',
}: {
  visible: boolean;
  onClose: () => void;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  tone?: 'primary' | 'danger';
  title?: string;
  children: React.ReactNode;
  align?: 'center' | 'stretch';
}) {
  const color = tone === 'danger' ? colors.danger : colors.primary;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={styles.tap}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cancelar"
        />
        <View style={[styles.card, { alignItems: align }]}>
          {icon ? (
            <View style={[styles.icon, tone === 'danger' && styles.iconDanger]}>
              <Ionicons name={icon} size={26} color={color} />
            </View>
          ) : null}
          {title ? (
            <Text style={[styles.title, align === 'center' && styles.titleCenter]}>{title}</Text>
          ) : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: spacing.lg,
  },
  tap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
    width: '100%',
    // Un diálogo ancho obliga a leer en línea larga justo cuando hay que decidir
    // algo. Se queda en el ancho de un párrafo cómodo.
    maxWidth: 420,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    marginBottom: spacing.sm,
    alignSelf: 'center',
  },
  iconDanger: { backgroundColor: colors.dangerMuted, borderColor: colors.danger },
  title: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  titleCenter: { textAlign: 'center' },
});
