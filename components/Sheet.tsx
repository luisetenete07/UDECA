import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../lib/theme';

/**
 * La hoja que sube desde abajo.
 *
 * Estaba escrita seis veces —y en once pantallas más a mano—, cada una con su
 * fondo, su radio superior, su asa y sus paddings copiados. Copiar no sale
 * gratis: los valores se separan solos. El velo estaba al 60 % en unas y al
 * 65 % en otras, el alto máximo al 88 % o al 90 %, y la zona de cerrar se
 * llamaba `tap` en un sitio y `backdropTap` en otro.
 *
 * LA ZONA DE CERRAR VA DETRÁS DE LA HOJA, no envolviéndola. Parece lo mismo y
 * no lo es: en React Native un toque que nadie recoge sube al padre, así que
 * una hoja metida dentro del `Pressable` que cierra se cierra al tocar su
 * propio título. Dos de las seis lo hacían así y se cerraban solas.
 */
export function Sheet({
  visible,
  onClose,
  children,
  title,
  subtitle,
  /** Contenido largo (formularios): lo envuelve en un ScrollView. */
  scroll = false,
  /** Alto máximo. Por defecto deja ver algo de lo que hay detrás. */
  maxHeight = '90%',
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  scroll?: boolean;
  maxHeight?: DimensionValue;
}) {
  const cuerpo = scroll ? (
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    children
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={styles.tap}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        />
        <View style={[styles.sheet, { maxHeight }]}>
          {/* El asa es la señal de "esto sube y baja", y la equis es para el
              ordenador: ahí no hay gesto de deslizar ni botón de atrás, así que
              el asa no significa nada y tocar el velo hay que adivinarlo. La
              app se usa también en escritorio, con lo que una salida visible no
              es un adorno. Van en la misma fila para no pisar el contenido. */}
          <View style={styles.grab}>
            <View style={styles.handle} />
            <Pressable
              onPress={onClose}
              style={styles.close}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          {title ? (
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
          ) : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {cuerpo}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.62)' },
  tap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
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
    // En tablet y ordenador una hoja de lado a lado son mil píxeles de ancho
    // para tres opciones: se queda centrada y del ancho de una columna.
    maxWidth: 640,
    alignSelf: 'center',
  },
  grab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    // Alto del botón de cerrar, para que el asa quede centrada en la fila y no
    // pegada al borde de arriba.
    minHeight: 26,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  // Fuera del flujo: así el asa se centra respecto a la hoja, no respecto al
  // hueco que deja la equis.
  close: { position: 'absolute', right: 0, top: 0, padding: 2 },
  title: { ...typography.h2, color: colors.text },
  subtitle: { ...typography.small, color: colors.textMuted, marginTop: 2, marginBottom: spacing.xs },
});
