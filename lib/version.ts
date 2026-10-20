/**
 * Actualizar es obligatorio: quién se queda fuera y cuándo.
 *
 * POR QUÉ EXISTE
 *
 * Una app instalada no se actualiza sola. Quien tenga desactivadas las
 * actualizaciones automáticas puede seguir meses con una versión vieja, y eso
 * no es solo que se pierda lo nuevo: es que sigue usando los fallos que ya
 * están arreglados, escribe datos con reglas antiguas y escribe al soporte por
 * cosas que se corrigieron en marzo. Con dos versiones distintas en la calle,
 * cada fallo que llega hay que responderlo dos veces.
 *
 * EL NÚMERO QUE MANDA, Y POR QUÉ NO ES EL DE COMPILACIÓN
 *
 * Se compara `version` de app.json ("1.0.0"), no el número de compilación. El
 * de compilación lo sube EAS SOLO, en cada build, así que gatillar con él
 * obligaría a actualizar a todo el mundo cada vez que se compila algo — incluso
 * una prueba que no llega a publicarse.
 *
 * `version` la sube una persona a propósito, y eso es justo lo que tiene que
 * ser: forzar la actualización de todos los móviles es una decisión, no un
 * efecto secundario.
 *
 * QUIÉN DECIDE
 *
 * El servidor, no la app: `config/version` en Firestore, campo `minima`. Se
 * cambia desde la consola de Firebase y hace efecto en cuanto alguien abre la
 * app, sin publicar nada. Si tuviera que decidirlo la app, haría falta una
 * versión nueva para obligar a actualizar a la anterior, que es la pescadilla.
 *
 * FALLA HACIA EL LADO BUENO, SIEMPRE
 *
 * Si el documento no existe, no se puede leer, viene vacío o trae algo que no
 * es una versión, NO SE BLOQUEA A NADIE. Un muro que aparece por un fallo de
 * red deja sin app a todo el mundo a la vez, y encima justo cuando el servidor
 * va mal. Entre "no obligo a actualizar a alguien que debería" y "dejo a todos
 * fuera por un error mío", no hay duda.
 *
 * AQUÍ NO SE IMPORTA NADA DE LA APP
 *
 * Ni `expo-constants` ni React Native. Es lo que permite que
 * scripts/check-actualizar.mjs pruebe estas cuentas en Node pelado, y esta es
 * de las poquísimas funciones capaces de dejar fuera a TODOS los usuarios a la
 * vez: justo la que no puede quedarse sin probar. La versión que lleva el móvil
 * vive en lib/versionDeLaApp.ts, que sí necesita la app.
 */

/**
 * Compara dos versiones tipo "1.2.3".
 *
 * Devuelve negativo si `a` es anterior, 0 si son la misma y positivo si `a` es
 * posterior. Las partes que falten cuentan como cero, así que "1.2" y "1.2.0"
 * son la misma versión.
 */
export function comparaVersiones(a: string, b: string): number {
  const trozos = (v: string) =>
    String(v ?? '')
      .trim()
      .split('.')
      .map((n) => Number.parseInt(n, 10));
  const x = trozos(a);
  const y = trozos(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const p = Number.isFinite(x[i]) ? x[i] : 0;
    const q = Number.isFinite(y[i]) ? y[i] : 0;
    if (p !== q) return p - q;
  }
  return 0;
}

/** ¿Esto se parece a una versión? "1.2.3" sí; "", "última" o "1.x" no. */
export function esVersion(v: unknown): v is string {
  return typeof v === 'string' && /^\d+(\.\d+)*$/.test(v.trim());
}

/**
 * ¿Hay que obligar a actualizar?
 *
 * `minima` es lo que dice el servidor. `actual` es lo que lleva este móvil.
 * Cualquier cosa rara en cualquiera de los dos devuelve `false`: ver arriba por
 * qué esto falla siempre hacia el lado de dejar entrar.
 */
export function tocaActualizar(actual: string, minima: unknown): boolean {
  if (!esVersion(minima) || !esVersion(actual)) return false;
  return comparaVersiones(actual, minima) < 0;
}

/**
 * LO QUE DICE LA TIENDA, SIN TOCAR NADA
 *
 * Lo de arriba es a mano: alguien sube `minima` en Firebase. Esto es solo:
 * cada vez que se entra, se pregunta a la App Store o a Google Play si hay una
 * versión posterior a la instalada. Si la hay, sale el aviso. Durante los
 * primeros días se puede dejar para luego (vuelve a salir en cada entrada);
 * pasados esos días, ya no.
 *
 * POR QUÉ HAY DÍAS DE MARGEN Y NO ES OBLIGATORIO DESDE EL PRIMER MINUTO
 *
 * La tienda no publica en todas partes a la vez. La búsqueda de Apple puede
 * decir que hay una versión nueva horas antes de que la ficha deje pulsar
 * "Actualizar" en el país de quien mira; un muro en ese rato manda a una
 * tienda donde no hay nada que bajar, y no deja volver. Con unos días de
 * margen, cuando el muro llega, la versión ya está en todas las fichas.
 */
export const DIAS_PARA_ACTUALIZAR = 3;

/** 'nada': al día. 'aviso': hay versión nueva, se puede dejar para luego. 'obligatorio': ya no. */
export type AvisoDeVersion = 'nada' | 'aviso' | 'obligatorio';

/**
 * Qué toca enseñar, sabiendo si la tienda tiene una versión nueva y cuántos
 * días lleva fuera. Si no se sabe cuántos, cuenta como recién salida: ante la
 * duda, aviso y no muro.
 */
export function avisoDeVersion(hayNueva: unknown, dias: unknown): AvisoDeVersion {
  if (hayNueva !== true) return 'nada';
  const lleva = typeof dias === 'number' && Number.isFinite(dias) ? dias : 0;
  return lleva >= DIAS_PARA_ACTUALIZAR ? 'obligatorio' : 'aviso';
}

/**
 * Lee la respuesta de la búsqueda de la App Store (itunes.apple.com/lookup).
 *
 * Solo hay versión nueva si la de la tienda es POSTERIOR a la instalada: quien
 * prueba una versión de TestFlight más nueva que la publicada no tiene que ver
 * nada. Y si la nueva pide un iOS que este móvil no tiene, tampoco: no podría
 * instalarla, y un aviso imposible de cumplir acaba en muro sin salida.
 *
 * Cualquier cosa rara —sin resultados, sin versión, fechas que no son fechas—
 * se lee como "no hay nada nuevo".
 */
export function novedadEnLaAppStore(
  instalada: string,
  respuesta: unknown,
  iosDelMovil: unknown,
  ahora: number
): { hayNueva: boolean; dias: number } {
  const nada = { hayNueva: false, dias: 0 };
  const resultados = (respuesta as { results?: unknown } | null)?.results;
  const ficha = Array.isArray(resultados) ? resultados[0] : null;
  if (!ficha || typeof ficha !== 'object') return nada;
  const { version, minimumOsVersion, currentVersionReleaseDate } = ficha as Record<string, unknown>;
  if (!esVersion(version) || !esVersion(instalada)) return nada;
  if (comparaVersiones(version, instalada) <= 0) return nada;
  if (esVersion(minimumOsVersion)) {
    const ios = String(iosDelMovil ?? '');
    if (!esVersion(ios) || comparaVersiones(ios, minimumOsVersion) < 0) return nada;
  }
  const salio =
    typeof currentVersionReleaseDate === 'string' ? Date.parse(currentVersionReleaseDate) : NaN;
  const dias = Number.isFinite(salio) ? Math.max(0, Math.floor((ahora - salio) / 86_400_000)) : 0;
  return { hayNueva: true, dias };
}

/**
 * Dónde se descarga la versión nueva.
 *
 * En la web no hay tienda: la versión nueva llega recargando, y de eso se
 * encarga el propio navegador (ver el aviso de versión en app/+html.tsx).
 */
export const ID_EN_LA_APP_STORE = '6794591283';
export const FICHA_EN_LA_APP_STORE = `https://apps.apple.com/app/id${ID_EN_LA_APP_STORE}`;
export const FICHA_EN_GOOGLE_PLAY =
  'https://play.google.com/store/apps/details?id=entrenadores.app';
/** En Android este esquema abre la app de Play directamente, sin pasar por la web. */
export const PLAY_DIRECTO = 'market://details?id=entrenadores.app';
