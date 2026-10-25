import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import { RestTimer } from './RestTimer';
import { useActiveRest } from '../lib/restTimerStore';
import { spacing } from '../lib/theme';

/**
 * El crono de descanso FLOTANDO, montado en el layout del alumno: así sigue
 * corriendo y a la vista aunque el alumno se vaya a Progreso, Nutrición o
 * cualquier otra pestaña a mitad de descanso.
 *
 * En la pantalla de entreno NO flota: ahí va dentro, debajo de las series
 * (ver app/(client)/workout.tsx). Flotando tapaba los botones de "Anterior" y
 * "Siguiente", justo los que se tocan al acabar el descanso.
 */
const TAB_BAR_HEIGHT = Platform.OS === 'web' ? 60 : 84;

export function GlobalRestTimer() {
  const rest = useActiveRest();
  const ruta = usePathname();
  if (!rest || enLaPantallaDeEntreno(ruta)) return null;
  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <RestTimer key={rest.id} rest={rest} />
    </View>
  );
}

/** ¿Es la pantalla de entreno? Ahí el crono va dentro, no flotando. */
export function enLaPantallaDeEntreno(ruta: string | null | undefined): boolean {
  return /(^|\/)workout\/?$/.test(ruta ?? '');
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: TAB_BAR_HEIGHT + spacing.sm,
  },
});
