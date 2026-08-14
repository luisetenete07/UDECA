import { useSyncExternalStore } from 'react';
import { idiomaDe, traducir, type Idioma } from './i18n';

/**
 * El idioma en curso, global.
 *
 * Vive fuera de React por lo mismo que el crono de descanso: lo necesitan
 * pantallas que no cuelgan unas de otras y algún sitio que no es un componente
 * (un aviso, un texto que se arma antes de pintar). Un contexto habría
 * obligado a envolver la app entera y a pasarlo hacia abajo por sitios donde
 * no pinta nada.
 *
 * Arranca en el idioma del teléfono y lo pisa lo que el usuario elija en su
 * perfil, en cuanto su perfil carga.
 */

function idiomaDelSistema(): string | undefined {
  try {
    // Intl está en web y en Hermes con Intl. Si no estuviera, español.
    return new Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

let actual: Idioma = idiomaDe(undefined, idiomaDelSistema());
const oyentes = new Set<() => void>();

export function getIdioma(): Idioma {
  return actual;
}

/** Cambia el idioma de toda la app. */
export function setIdioma(idioma: Idioma) {
  if (idioma === actual) return;
  actual = idioma;
  oyentes.forEach((o) => o());
}

/**
 * Aplica la preferencia guardada del usuario.
 *
 * Se llama al cargar el perfil. Sin preferencia, manda el idioma del teléfono
 * y no se toca nada: quien no ha elegido no ha elegido español, ha elegido
 * "lo que hable mi móvil".
 */
export function aplicarIdiomaDelPerfil(elegido: string | undefined) {
  setIdioma(idiomaDe(elegido, idiomaDelSistema()));
}

function suscribir(o: () => void) {
  oyentes.add(o);
  return () => {
    oyentes.delete(o);
  };
}

/** Hook: el idioma actual, y se repinta al cambiarlo. */
export function useIdioma(): Idioma {
  return useSyncExternalStore(suscribir, getIdioma, getIdioma);
}

/**
 * Hook de traducción: `const t = useT(); t('Mi entrenamiento')`.
 *
 * La clave es la frase en español, así que una pantalla sin tocar sigue
 * estando bien y una frase sin traducir sale en español, nunca en blanco.
 */
export function useT(): (texto: string, partes?: Record<string, string | number>) => string {
  const idioma = useIdioma();
  return (texto, partes) => traducir(texto, idioma, partes);
}

/** Traducir fuera de un componente (avisos, textos que se arman antes). */
export function t(texto: string, partes?: Record<string, string | number>): string {
  return traducir(texto, actual, partes);
}

/**
 * Una frase con datos dentro: frase`Día ${n} de ${total}`.
 *
 * EL PROBLEMA QUE RESUELVE. La clave del diccionario es la frase en español,
 * pero "Día 3 de 5" no es una frase: es una de las mil que salen de esa
 * plantilla, y ninguna va a estar en el diccionario. Sin esto, todo el texto
 * que lleva un número dentro —las cuotas, las rachas, los días de prueba, los
 * avisos del bloque— se quedaría en español para siempre.
 *
 * CÓMO. La plantilla se reconstruye con huecos numerados, y ESA es la clave:
 * frase`Día ${n} de ${total}` busca "Día {0} de {1}". Los datos se meten
 * DESPUÉS de traducir, así que un nombre o una cifra nunca dependen del idioma
 * ni pueden salir traducidos por accidente.
 *
 * En español devuelve exactamente lo que se lee en el código, y si a la frase
 * le falta traducción, también: lo peor que pasa es que salga en español.
 *
 * Solo para texto que se ENSEÑA. Lo que se guarda (el nombre de un día del
 * plan, por ejemplo) se queda como está: si se tradujera al escribirlo, el
 * alumno vería inglés dentro de sus datos aunque volviera al español.
 */
export function frase(trozos: TemplateStringsArray, ...valores: unknown[]): string {
  let clave = trozos[0];
  const partes: Record<string, string> = {};
  for (let i = 1; i < trozos.length; i++) {
    partes[String(i - 1)] = String(valores[i - 1]);
    clave += `{${i - 1}}` + trozos[i];
  }
  return traducir(clave, actual, partes);
}
