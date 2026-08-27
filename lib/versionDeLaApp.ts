import Constants from 'expo-constants';

/**
 * La versión que lleva esta copia de la app ("1.0.0", de app.json).
 *
 * Vive sola, en un fichero de una línea, porque leerla necesita
 * `expo-constants` y eso arrastra la app entera. Las CUENTAS de qué versión
 * obliga a actualizar están en lib/version.ts, sin importar nada, para poder
 * probarlas sin arrancar nada — que en una función capaz de dejar a todo el
 * mundo fuera no es un lujo.
 *
 * Vacía si no se puede leer. `tocaActualizar` trata eso como "no bloquear".
 */
export const VERSION_DE_LA_APP: string =
  (Constants.expoConfig?.version as string | undefined) ?? '';
