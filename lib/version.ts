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
 * Dónde se descarga la versión nueva.
 *
 * En la web no hay tienda: la versión nueva llega recargando, y de eso se
 * encarga el propio navegador (ver el aviso de versión en app/+html.tsx).
 */
export const FICHA_EN_LA_APP_STORE = 'https://apps.apple.com/app/id6794591283';
export const FICHA_EN_GOOGLE_PLAY =
  'https://play.google.com/store/apps/details?id=entrenadores.app';
/** En Android este esquema abre la app de Play directamente, sin pasar por la web. */
export const PLAY_DIRECTO = 'market://details?id=entrenadores.app';
