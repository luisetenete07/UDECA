/**
 * Caché de sesión en memoria para datos de pantalla (stale-while-revalidate).
 *
 * Patrón: al montar una pantalla, si hay datos cacheados se pintan AL INSTANTE
 * (sin spinner) y la carga fresca sigue en segundo plano y actualiza al llegar.
 * Así cambiar de pestaña es inmediato aunque los datos siempre acaben frescos.
 * Se vacía al recargar la app (solo memoria; nada se persiste).
 */
const store = new Map<string, unknown>();

export function getCached<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function setCached<T>(key: string, value: T): void {
  store.set(key, value);
}

/** Invalida claves por prefijo (p. ej. al cerrar sesión). */
export function clearCache(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
