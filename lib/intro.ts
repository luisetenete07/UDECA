import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Recuerda si ya se ha visto la presentación de bienvenida. Es una marca del
 * DISPOSITIVO, no de la cuenta: quien acaba de instalar la app y aún no tiene
 * cuenta debe ver primero qué es UDECA, y quien ya la conoce entra directo al
 * inicio de sesión.
 */

const KEY = 'udeca-intro-seen';

export async function hasSeenIntro(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    // Si el almacenamiento falla, mejor enseñar la presentación que bloquear.
    return false;
  }
}

export async function markIntroSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // No es crítico: como mucho se vuelve a ver una vez.
  }
}
