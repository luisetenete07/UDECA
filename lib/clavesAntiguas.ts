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

/**
 * En la web, lo mismo pero en el acto, sin esperar a nada.
 *
 * Allí el almacenamiento es el del navegador, que es síncrono, y la app no
 * puede quedarse en blanco esperando: la web se publica con cada pantalla ya
 * pintada en el HTML, y si el arranque esperase a una promesa, ese HTML
 * saldría vacío (pasó: la publicación lo detectó y se paró). Al generar el
 * HTML no hay navegador ni nada que migrar, y no hace nada.
 */
export function migrarClavesAntiguasEnLaWeb() {
  try {
    const almacen = typeof window !== 'undefined' ? window.localStorage : undefined;
    if (!almacen) return;
    const viejas: string[] = [];
    for (let i = 0; i < almacen.length; i++) {
      const k = almacen.key(i);
      if (k && claveNueva(k) !== null) viejas.push(k);
    }
    for (const k of viejas) {
      const nueva = claveNueva(k)!;
      const v = almacen.getItem(k);
      if (v !== null && almacen.getItem(nueva) === null) almacen.setItem(nueva, v);
      almacen.removeItem(k);
    }
  } catch {
    // Igual que en el móvil: si falla, se sigue sin lo guardado de antes.
  }
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
