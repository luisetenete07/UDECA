import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Ancla local del ciclo (Método REIN TENA) por rutina. Permite que el ALUMNO
 * reinicie su ciclo en el Día 1 cuando le toca un descanso opcional, sin tener
 * que escribir en la rutina (que pertenece al entrenador). Se guarda en el
 * dispositivo; `resolveTodaySession` usa la fecha más reciente entre esta y la
 * del coach, así que se autocorrige si el entrenador reprograma el ciclo.
 */
const key = (routineId: string) => `udeca-cycle-anchor-${routineId}`;

export async function getCycleAnchor(routineId: string): Promise<number | null> {
  try {
    const v = await AsyncStorage.getItem(key(routineId));
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

/** Fija el ancla del ciclo a HOY (medianoche) para reiniciar en el Día 1. */
export async function setCycleAnchorToday(routineId: string): Promise<number> {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const ts = d.getTime();
  try {
    await AsyncStorage.setItem(key(routineId), String(ts));
  } catch {
    // Si falla el guardado, el reinicio solo durará esta sesión (estado en memoria).
  }
  return ts;
}
