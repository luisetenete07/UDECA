import { Linking, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import {
  FICHA_EN_GOOGLE_PLAY,
  FICHA_EN_LA_APP_STORE,
  ID_EN_LA_APP_STORE,
  PLAY_DIRECTO,
  avisoDeVersion,
  novedadEnLaAppStore,
  type AvisoDeVersion,
} from './version';
import { VERSION_DE_LA_APP } from './versionDeLaApp';

/**
 * ¿Tiene la tienda una versión más nueva que la instalada?
 *
 * Las cuentas están en lib/version.ts; aquí solo se pregunta.
 *
 *  - iPhone: la búsqueda pública de la App Store, por el id de la ficha.
 *  - Android: Google Play, desde el propio móvil (modules/calico-tienda). Play
 *    no tiene una búsqueda pública como la de Apple; quien sabe si a ESTE móvil
 *    le toca la versión nueva —por modelo, por versión de Android, por
 *    lanzamiento escalonado— es la app de Play.
 *
 * Sin red, sin tienda, sin módulo (una versión anterior, la web): 'nada'.
 */
export async function versionEnLaTienda(): Promise<AvisoDeVersion> {
  try {
    if (Platform.OS === 'ios') return await deLaAppStore();
    if (Platform.OS === 'android') return await deGooglePlay();
  } catch {
    // Ante la duda, nada: ni aviso ni muro.
  }
  return 'nada';
}

/** Abre la ficha de la app en su tienda. */
export function abrirLaTienda() {
  if (Platform.OS === 'ios') {
    Linking.openURL(FICHA_EN_LA_APP_STORE).catch(() => {});
    return;
  }
  // En Android el esquema de Play abre la app directamente; si el móvil no
  // tiene los servicios de Google, queda la web.
  Linking.openURL(PLAY_DIRECTO).catch(() => Linking.openURL(FICHA_EN_GOOGLE_PLAY).catch(() => {}));
}

async function deLaAppStore(): Promise<AvisoDeVersion> {
  // Solo cuenta la tienda del país del móvil, y si ahí no está, nada.
  //
  // Antes, si no la encontraba, miraba la de Estados Unidos (la que contesta
  // sin decir país). Pero que una versión esté allí no quiere decir que se
  // pueda bajar aquí: pasó que la App Store de España no tenía la app a la
  // venta y la de Estados Unidos sí. Con aquella vuelta, a quien estaba en
  // España le habría llegado un "actualiza" —y a los días un muro— pidiéndole
  // algo que su tienda no tenía.
  const pais = paisDelMovil();
  if (!pais) return 'nada';
  const respuesta = await buscarEnLaAppStore(pais);
  if (!respuesta?.resultCount) return 'nada';
  const { hayNueva, dias } = novedadEnLaAppStore(
    VERSION_DE_LA_APP,
    respuesta,
    Platform.Version,
    Date.now()
  );
  return avisoDeVersion(hayNueva, dias);
}

async function buscarEnLaAppStore(pais: string): Promise<{ resultCount?: number } | null> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), 8000);
  try {
    // `t` cambia en cada consulta para que ninguna caché devuelva la ficha de ayer.
    const url = `https://itunes.apple.com/lookup?id=${ID_EN_LA_APP_STORE}&country=${pais}&t=${Date.now()}`;
    const r = await fetch(url, { signal: control.signal });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(reloj);
  }
}

function paisDelMovil(): string | null {
  try {
    const region = new Intl.DateTimeFormat().resolvedOptions().locale.split('-').pop() ?? '';
    return /^[A-Za-z]{2}$/.test(region) ? region.toLowerCase() : null;
  } catch {
    return null;
  }
}

interface ModuloDeTienda {
  /** null si Play no contesta (sin Play, instalada fuera de la tienda…). */
  versionNueva(): Promise<{ hay?: boolean; dias?: number } | null>;
}

const tienda: ModuloDeTienda | null =
  Platform.OS === 'android' ? requireOptionalNativeModule<ModuloDeTienda>('CalicoTienda') : null;

async function deGooglePlay(): Promise<AvisoDeVersion> {
  if (!tienda) return 'nada';
  const r = await tienda.versionNueva();
  return avisoDeVersion(r?.hay, r?.dias);
}
