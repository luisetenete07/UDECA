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
