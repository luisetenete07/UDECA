import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Texto';
import { Button } from './Button';
import { colors, radius, spacing, typography } from '../lib/theme';

/**
 * "Hay una versión nueva", los primeros días después de publicarla.
 *
 * Sale al entrar en cuanto la tienda tiene una versión posterior a la
 * instalada (lib/versionEnLaTienda.ts). Se puede dejar para luego, pero vuelve
 * a salir en la siguiente entrada; pasados unos días deja de ofrecer esa
 * salida y lo que sale es el muro de ActualizacionObligatoria. Por eso lo dice:
 * quien lo aparta hoy no se lleva una sorpresa la semana que viene.
 */
export function AvisoDeVersionNueva({
  onActualizar,
  onLuego,
}: {
  onActualizar: () => void;
  onLuego: () => void;
}) {
  return (
    <View style={styles.fondo}>
      <View style={styles.caja}>
        <View style={styles.icono}>
          <Ionicons name="arrow-up-circle" size={30} color={colors.primary} />
        </View>
        <Text style={styles.titulo}>Hay una versión nueva de CALICO</Text>
        <Text style={styles.texto}>
          Actualiza para tener lo último. Tus datos, tus rutinas y tu progreso
          siguen igual.
        </Text>
        <Text style={styles.nota}>En unos días hará falta para seguir usando la app.</Text>
        <Button
          title={Platform.OS === 'ios' ? 'Actualizar en la App Store' : 'Actualizar en Google Play'}
          onPress={onActualizar}
          style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}
        />
        <Button
          title="Ahora no"
          variant="ghost"
          onPress={onLuego}
          style={{ marginTop: spacing.xs, alignSelf: 'stretch' }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fondo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    zIndex: 9998,
  },
  caja: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.lg,
  },
  icono: {
    width: 62,
    height: 62,
    borderRadius: radius.full,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  titulo: { ...typography.h2, color: colors.text, textAlign: 'center' },
  texto: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  nota: {
    ...typography.small,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
