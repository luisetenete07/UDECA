import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * LAS CLAVES DE ANTES DE LLAMARSE CALICO.
 *
 * Lo que la app guarda en el móvil (entrenos pendientes de subir sin
 * conexión, el borrador de la sesión a medias, las cuentas recordadas, lo ya
 * visto de la bienvenida…) iba con el nombre anterior delante. Con el cambio de
 * nombre, las claves pasan a empezar por `calico`; sin esto, al actualizar se
 * perderían de golpe un entreno sin subir o una sesión a medias.
 *
 * Se hace una vez, al arrancar y antes de que nada lea: se copia cada clave
 * vieja a su nombre nuevo (si el nuevo aún no existe) y se borra la vieja. Es
 * idempotente y barato: sin claves viejas, es una sola lectura de la lista.
 *
 * El prefijo viejo se queda escrito aquí, y solo aquí: es lo único que tiene
 * que seguir reconociéndolo.
 */
const ANTES = 'udeca';
const AHORA = 'calico';

let enCurso: Promise<void> | null = null;

/** El nombre nuevo de una clave vieja, o null si no es de las de antes. */
export function claveNueva(clave: string): string | null {
  if (!clave.startsWith(`${ANTES}-`) && !clave.startsWith(`${ANTES}.`)) return null;
  return AHORA + clave.slice(ANTES.length);
}

export function migrarClavesAntiguas(): Promise<void> {
  if (!enCurso) {
    enCurso = (async () => {
      try {
        const todas = await AsyncStorage.getAllKeys();
        const viejas = todas.filter((k) => claveNueva(k) !== null);
        if (viejas.length === 0) return;
        const yaEstan = new Set(todas);
        const pares = await AsyncStorage.multiGet(viejas);
        const aCopiar = pares
          .filter(([k, v]) => v !== null && !yaEstan.has(claveNueva(k)!))
          .map(([k, v]) => [claveNueva(k)!, v!] as [string, string]);
        if (aCopiar.length > 0) await AsyncStorage.multiSet(aCopiar);
        await AsyncStorage.multiRemove(viejas);
      } catch {
        // Si falla, la app sigue: lo peor es empezar sin lo guardado de antes.
      }
    })();
  }
  return enCurso;
}
