import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { RestTimer } from './RestTimer';
import { stopRest, useActiveRest } from '../lib/restTimerStore';
import { spacing } from '../lib/theme';

/**
 * Capa flotante con el crono de descanso, montada en el LAYOUT del alumno
 * (no en la pantalla de entreno): así el cronómetro sigue corriendo y visible
 * aunque el alumno navegue a Progreso, Nutrición o cualquier otra pestaña.
 */
const TAB_BAR_HEIGHT = Platform.OS === 'web' ? 60 : 84;

export function GlobalRestTimer() {
  const rest = useActiveRest();
  if (!rest) return null;
  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <RestTimer key={rest.id} seconds={rest.seconds} title={rest.title} onDone={stopRest} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: TAB_BAR_HEIGHT + spacing.sm,
  },
});
