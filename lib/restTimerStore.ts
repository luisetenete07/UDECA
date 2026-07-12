import { useSyncExternalStore } from 'react';

/**
 * Estado GLOBAL del crono de descanso. Vive fuera de la pantalla de entreno
 * para que el cronómetro no se pare ni se reinicie al cambiar de sección:
 * el temporizador se pinta como capa flotante en el layout del alumno
 * (visible en cualquier pestaña) y aquí solo se guarda qué descanso corre.
 */
export interface ActiveRest {
  /** Identificador único del descanso (reinicia el crono al cambiar). */
  id: number;
  seconds: number;
  title?: string;
}

let current: ActiveRest | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function startRest(seconds: number, title?: string) {
  current = { id: nextId++, seconds, title };
  emit();
}

export function stopRest() {
  if (!current) return;
  current = null;
  emit();
}

export function getRest(): ActiveRest | null {
  return current;
}

/** Hook: se re-renderiza cuando empieza o termina un descanso. */
export function useActiveRest(): ActiveRest | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getRest,
    getRest
  );
}
