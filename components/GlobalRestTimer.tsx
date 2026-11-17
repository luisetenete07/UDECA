import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import { RestTimer } from './RestTimer';
import { useActiveRest } from '../lib/restTimerStore';
import { SE_APUNTA_EL_ENTRENO } from '../lib/modoDeEntreno';
import { spacing } from '../lib/theme';

/**
 * El crono de descanso FLOTANDO, montado en el layout del alumno: así sigue
 * corriendo y a la vista aunque el alumno se vaya a Progreso, Nutrición o
 * cualquier otra pestaña a mitad de descanso.
 *
 * Con el entreno en directo, en la pantalla de entreno NO flotaba: ahí iba
 * dentro, debajo de las series, porque flotando tapaba los botones de
 * "Anterior" y "Siguiente". Sin él (lib/modoDeEntreno.ts) esa pantalla es el
 * programa, y ahí es justo donde más falta hace: se pone la cuenta atrás y se
 * sigue leyendo lo que toca mientras corre.
 */
const TAB_BAR_HEIGHT = Platform.OS === 'web' ? 60 : 84;

export function GlobalRestTimer() {
  const rest = useActiveRest();
  const ruta = usePathname();
  if (!rest || (SE_APUNTA_EL_ENTRENO && enLaPantallaDeEntreno(ruta))) return null;
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
