import { useSyncExternalStore } from 'react';

/**
 * Estado GLOBAL del crono de descanso.
 *
 * Vive fuera de la pantalla de entreno para que el cronómetro no se pare ni se
 * reinicie al cambiar de sección. En la pantalla de entreno se pinta DENTRO,
 * debajo de las series (components/RestTimer.tsx, `enLinea`); en las demás
 * pestañas, como capa flotante (components/GlobalRestTimer.tsx).
 *
 * Por eso la hora a la que acaba está AQUÍ y no dentro del componente: al
 * pasar de una pantalla a otra se desmonta uno y se monta el otro, y los dos
 * tienen que contar lo mismo. Si cada uno guardara su propio final, al volver
 * a la pantalla de entreno el descanso empezaría otra vez de cero.
 */
export interface ActiveRest {
  /** Identificador único del descanso (cambia con cada descanso nuevo). */
  id: number;
  /** Duración total, para la barra (crece con "+15 s"). */
  seconds: number;
  title?: string;
  /** Momento absoluto (ms) en que termina. */
  endsAt: number;
}

let current: ActiveRest | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function startRest(seconds: number, title?: string) {
  current = { id: nextId++, seconds, title, endsAt: Date.now() + seconds * 1000 };
  emit();
}

/** Más descanso (o menos, con un número negativo) sobre el que ya corre. */
export function alargarDescanso(extra: number) {
  if (!current) return;
  current = {
    ...current,
    seconds: Math.max(1, current.seconds + extra),
    endsAt: Math.max(Date.now(), current.endsAt + extra * 1000),
  };
  emit();
}

export function stopRest() {
  if (!current) return;
  current = null;
  emit();
}

/** Para un descanso concreto: si ya ha empezado otro, no lo toca. */
export function stopRestSiEs(id: number) {
  if (current?.id === id) stopRest();
}

export function getRest(): ActiveRest | null {
  return current;
}

/** Segundos que quedan del descanso, contra el reloj real. */
export function restantes(rest: ActiveRest, ahora = Date.now()): number {
  return Math.max(0, Math.round((rest.endsAt - ahora) / 1000));
}

/** Hook: se re-renderiza cuando empieza, cambia o termina un descanso. */
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
